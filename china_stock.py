"""
china_stock.py — A-share stock data module

Standalone Python module (stdlib only: urllib, json, re).
Wraps Tencent, Sina, and EastMoney APIs for real-time quotes,
stock search, K-line history, and market indices.

Exported functions (consumed by backend/app.py):
    search_stock(q)         -> fuzzy stock search
    get_peers(codes)        -> batch real-time quotes
    get_quote(code)         -> detailed quote with THS extra fields
    get_history(code, days) -> K-line history
    get_market_indexes()    -> 7 major index quotes
    get_finance(codes)      -> financial metrics
"""

import json
import re
import urllib.request
import urllib.error
import urllib.parse
import ssl
import logging

logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────

TENCENT_QUOTE_URL = "https://qt.gtimg.cn/q={}"
TENCENT_KLINE_URL = "https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param={},day,,,{},qfq"
SINA_SEARCH_URL = "https://suggest3.sinajs.cn/suggest/type=11&key={}&name=suggest"
EASTMONEY_KLINE_URL = "https://push2.eastmoney.com/api/qt/stock/kline/get?secid={}.{}&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56,f57&klt=101&fqt=1&end=20500101&lmt={}"
SINA_FINANCE_URL = "https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getStockDetails?page=1&num=1&sort=code&asc=1&node={}&symbol={}"

# 7 major indices (Tencent codes)
MARKET_INDICES = [
    "sh000001",  # 上证指数
    "sh000688",  # 科创50
    "sh000016",  # 上证50
    "sz399001",  # 深证成指
    "sz399006",  # 创业板指
    "sh000300",  # 沪深300
    "sh000905",  # 中证500
]

# ── HTTP Utility ──────────────────────────────────────────────────────────

def fetch_url(url, timeout=10):
    """Robust HTTP GET with error handling. Returns response text or empty string."""
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "*/*",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    })
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            data = resp.read()
            # Try UTF-8 first, fall back to GBK for Sina
            try:
                return data.decode("utf-8")
            except UnicodeDecodeError:
                try:
                    return data.decode("gbk")
                except UnicodeDecodeError:
                    return data.decode("utf-8", errors="replace")
    except Exception as e:
        logger.warning("fetch_url failed: %s — %s", url, e)
        return ""


# ── Stock Prefix Utility ──────────────────────────────────────────────────

def auto_prefix(code):
    """
    Add sh/sz prefix based on numeric code.
    6xxxxx → sh (Shanghai)
    0xxxxx, 3xxxxx → sz (Shenzhen)
    9xxxxx → sh (B shares Shanghai)
    2xxxxx → sz (B shares Shenzhen)
    Otherwise default to sz.
    """
    code = code.strip()
    # Already prefixed
    if code.startswith("sh") or code.startswith("sz"):
        return code
    # Strip possible leading zeros or prefixes like '600519'
    m = re.match(r"(\d{6})", code)
    if not m:
        return code
    num = m.group(1)
    if num.startswith(("6", "9")):
        return "sh" + num
    elif num.startswith(("0", "3", "2")):
        return "sz" + num
    return "sz" + num


def strip_prefix(code):
    """Remove sh/sz prefix, return bare 6-digit code."""
    return re.sub(r"^(sh|sz)", "", code).strip()


# ── Tencent Quote Parser ──────────────────────────────────────────────────

def parse_tencent_quote(raw):
    """
    Parse Tencent tilde-delimited quote format.
    Input: v_sh600519="...~..."
    Output: dict with parsed fields, or empty dict on failure.

    Field positions (0-indexed within the ~ split):
        1  = name
        2  = code
        3  = current price
        4  = yesterday close
        5  = open
        6  = volume (in 手, 1手=100 shares)
        7-28 = buy/sell order book
        31 = change_amt
        32 = change_pct (%)
        33 = high
        34 = low
        37 = amount (万元)
        38 = turnover ratio (%)
        39 = PE ratio
        43 = amplitude (%)
        44 = market_cap (亿元)
    """
    try:
        # Extract the quoted string
        m = re.search(r'"(.*)"', raw)
        if not m:
            return {}
        parts = m.group(1).split("~")
        if len(parts) < 46:
            return {}

        def sf(idx):
            """Safe float conversion, returns None on failure."""
            v = parts[idx].strip()
            if not v:
                return None
            try:
                return float(v)
            except (ValueError, IndexError):
                return None

        price = sf(3)
        yclose = sf(4)
        open_ = sf(5)
        high = sf(33)
        low = sf(34)
        volume_hands = sf(6)   # in 手
        amount = sf(37)        # 万元
        market_cap = sf(44)    # 亿元
        turnover = sf(38)
        pe = sf(39)
        amplitude = sf(43)

        name = parts[1].strip() if len(parts) > 1 else ""
        code = parts[2].strip() if len(parts) > 2 else ""
        market = "sh" if code.startswith(("6", "9")) else "sz"

        # Calculate change
        change_amt = None
        change_pct = None
        if price is not None and yclose is not None and yclose != 0:
            change_amt = price - yclose
            change_pct = round((change_amt / yclose) * 100, 2)
            change_amt = round(change_amt, 2)

        # Convert volume from 手 to shares
        volume = None
        if volume_hands is not None:
            volume = int(volume_hands * 100)

        # Convert units: Tencent returns amount in 万元, market_cap in 亿元
        # Frontend expects 元
        amount_yuan = amount * 10000 if amount is not None else None
        market_cap_yuan = market_cap * 100000000 if market_cap is not None else None

        return {
            "code": code,
            "market": market,
            "name": name,
            "price": price,
            "change_pct": change_pct,
            "change_amt": change_amt,
            "high": high,
            "low": low,
            "open": open_,
            "yclose": yclose,
            "volume": volume,
            "amount": amount_yuan,
            "pe": pe,
            "market_cap": market_cap_yuan,
            "turnover": turnover,
            "amplitude": amplitude,
        }
    except Exception as e:
        logger.warning("parse_tencent_quote error: %s", e)
        return {}


# ── K-Line Sources ────────────────────────────────────────────────────────

def tencent_kline(code, days=60):
    """
    Primary K-line source: Tencent.
    Returns list of [date, open, close, high, low, volume] or None.
    """
    prefixed = auto_prefix(code)
    url = TENCENT_KLINE_URL.format(prefixed, days)
    raw = fetch_url(url)

    if not raw:
        return None

    try:
        data = json.loads(raw)
        code_key = prefixed
        day_data = data.get("data", {}).get(code_key, {})
        if not day_data:
            # Try qfqday (forward-adjusted)
            klines = day_data.get("day") or data.get("data", {}).get(code_key, {}).get("qfqday")
        else:
            klines = day_data.get("day") or day_data.get("qfqday")

        if not klines:
            return None

        result = []
        for k in klines:
            # Format: ["2026-05-20", open, close, high, low, volume, amount]
            if len(k) >= 6:
                result.append({
                    "date": str(k[0]),
                    "open": float(k[1]),
                    "close": float(k[2]),
                    "high": float(k[3]),
                    "low": float(k[4]),
                    "volume": int(float(k[5])),
                })
        return result if result else None
    except (json.JSONDecodeError, KeyError, IndexError, ValueError, TypeError) as e:
        logger.warning("tencent_kline parse error for %s: %s", code, e)
        return None


def eastmoney_kline(code, days=60):
    """
    Backup K-line source: EastMoney.
    Returns list of [date, open, close, high, low, volume] or None.
    """
    prefixed = auto_prefix(code)
    market = "1" if prefixed.startswith("sh") else "0"
    bare_code = strip_prefix(code)
    url = EASTMONEY_KLINE_URL.format(market, bare_code, days)
    raw = fetch_url(url)

    if not raw:
        return None

    try:
        data = json.loads(raw)
        klines = data.get("data", {}).get("klines", [])
        if not klines:
            return None

        result = []
        for k in klines:
            # Format: "2026-05-20,open,close,high,low,volume,amount"
            parts = str(k).split(",")
            if len(parts) >= 6:
                result.append({
                    "date": parts[0].strip(),
                    "open": float(parts[1]),
                    "close": float(parts[2]),
                    "high": float(parts[3]),
                    "low": float(parts[4]),
                    "volume": int(float(parts[5])),
                })
        return result if result else None
    except (json.JSONDecodeError, KeyError, IndexError, ValueError, TypeError) as e:
        logger.warning("eastmoney_kline parse error for %s: %s", code, e)
        return None


def sina_kline(code, market, days=60):
    """
    Backup K-line source: Sina Finance (alternative).
    Currently returns None as no reliable Sina K-line endpoint is available.
    Kept as placeholder for future implementation.
    """
    # No documented HTTPS endpoint for Sina stock K-lines.
    # The old http://money.finance.sina.com.cn API was HTTP-only.
    # Return None to fall through to the next source.
    return None


# ── Stock Search ──────────────────────────────────────────────────────────

def search_stock(q):
    """
    Fuzzy search A-share stocks via Sina suggest API.
    Returns list of {code, market, name}.
    """
    if not q or not q.strip():
        return []
    keyword = urllib.parse.quote(q.strip())
    url = SINA_SEARCH_URL.format(keyword)
    raw = fetch_url(url)

    if not raw:
        return []

    try:
        # Response format: var suggest = "...|...|...;..."
        # Extract the data part between the first = and the last ;
        m = re.search(r'=\s*["\']?(.*?)["\']?\s*;', raw)
        if not m:
            return []

        data_str = m.group(1)
        # Data format: "code1,market1,name1;code2,market2,name2"
        items = data_str.split(";")
        results = []
        seen = set()
        for item in items:
            parts = item.strip().split(",")
            if len(parts) >= 3:
                # Parts could be: name,market,code or more fields
                name = parts[0].strip()
                market = parts[1].strip().lower()
                code = parts[2].strip()
                # Strip sh/sz prefix if present on code
                if code.startswith(('sh', 'sz', 'SH', 'SZ')):
                    code = code[2:]
                # Deduplicate
                key = f"{code}:{name}"
                if key not in seen:
                    seen.add(key)
                    results.append({
                        "code": code,
                        "market": market,
                        "name": name,
                    })
        return results
    except Exception as e:
        logger.warning("search_stock error: %s", e)
        return []


# ── Batch Quotes (peers) ──────────────────────────────────────────────────

def get_peers(codes):
    """
    Batch real-time quotes for multiple stocks.
    Uses Tencent quote API (supports comma-separated codes).
    Returns list of dicts with {code, market, name, price, change_pct,
    change_amt, high, low, open, yclose, volume, amount, pe,
    market_cap, turnover, amplitude}.
    """
    if not codes:
        return []

    # Prefix and join
    prefixed = [auto_prefix(c) for c in codes]
    joined = ",".join(prefixed)
    url = TENCENT_QUOTE_URL.format(joined)
    raw = fetch_url(url)

    if not raw:
        return []

    results = []
    # Tencent returns multiple lines, one per stock
    lines = raw.strip().split("\n")
    for line in lines:
        parsed = parse_tencent_quote(line)
        if parsed and parsed.get("code"):
            results.append(parsed)
    return results


# ── Detailed Quote (with THS extra fields) ────────────────────────────────

def get_quote(code):
    """
    Detailed quote for a single stock with extra THS fields.
    Returns dict with all standard fields plus 'ths' sub-dict:
        ths: {pe_static, pe_dynamic, free_cap, highest_52w, lowest_52w}
    """
    prefixed = auto_prefix(code)
    url = TENCENT_QUOTE_URL.format(prefixed)
    raw = fetch_url(url)

    base = {}
    if raw:
        base = parse_tencent_quote(raw)

    # Get THS extra data from Sina finance
    ths_data = _fetch_ths_data(code)

    result = {
        "code": base.get("code", strip_prefix(code)),
        "market": base.get("market", "sh" if prefixed.startswith("sh") else "sz"),
        "name": base.get("name", ""),
        "price": base.get("price"),
        "change_pct": base.get("change_pct"),
        "change_amt": base.get("change_amt"),
        "high": base.get("high"),
        "low": base.get("low"),
        "open": base.get("open"),
        "yclose": base.get("yclose"),
        "volume": base.get("volume"),
        "amount": base.get("amount"),
        "pe": base.get("pe"),
        "market_cap": base.get("market_cap"),
        "turnover": base.get("turnover"),
        "amplitude": base.get("amplitude"),
        "ths": ths_data,
    }
    return result


def _fetch_ths_data(code):
    """
    Fetch THS (Tonghuashun) extra data from Sina finance API.
    Returns {pe_static, pe_dynamic, free_cap, highest_52w, lowest_52w}.
    """
    bare = strip_prefix(code)
    market = "sz" if bare.startswith(("0", "3", "2")) else "sh"
    # Try both markets
    for node in ["sz", "sh"]:
        url = SINA_FINANCE_URL.format(node, bare)
        raw = fetch_url(url)
        if raw:
            try:
                data = json.loads(raw)
                if isinstance(data, list) and len(data) > 0:
                    item = data[0]
                    return {
                        "pe_static": _safe_float(item.get("pe_static")),
                        "pe_dynamic": _safe_float(item.get("pe_dynamic")),
                        "free_cap": _safe_float(item.get("free_cap")),
                        "highest_52w": _safe_float(item.get("highest_52w")),
                        "lowest_52w": _safe_float(item.get("lowest_52w")),
                    }
            except (json.JSONDecodeError, KeyError, TypeError):
                continue
    return {
        "pe_static": None,
        "pe_dynamic": None,
        "free_cap": None,
        "highest_52w": None,
        "lowest_52w": None,
    }


def _safe_float(v):
    """Convert value to float or return None."""
    if v is None:
        return None
    try:
        return float(v)
    except (ValueError, TypeError):
        return None


# ── K-Line History ────────────────────────────────────────────────────────

def get_history(code, days=60):
    """
    Get K-line history with 3-level failover:
    1. Tencent (primary)
    2. Sina (backup 1)
    3. EastMoney (backup 2)
    4. Return empty list if all fail

    Returns [{date, open, close, high, low, volume}]
    """
    bare = strip_prefix(code)
    market = "sh" if bare.startswith(("6", "9")) else "sz"

    # Level 1: Tencent
    klines = tencent_kline(code, days)
    if klines:
        return klines

    # Level 2: Sina
    klines = sina_kline(code, market, days)
    if klines:
        return klines

    # Level 3: EastMoney
    klines = eastmoney_kline(code, days)
    if klines:
        return klines

    # All sources failed
    logger.warning("get_history: all K-line sources failed for %s", code)
    return []


# ── Market Indices ────────────────────────────────────────────────────────

def get_market_indexes():
    """
    Get real-time quotes for 7 major market indices.
    Returns list of dicts with same fields as get_peers.
    """
    joined = ",".join(MARKET_INDICES)
    url = TENCENT_QUOTE_URL.format(joined)
    raw = fetch_url(url)

    if not raw:
        return []

    results = []
    lines = raw.strip().split("\n")
    for line in lines:
        parsed = parse_tencent_quote(line)
        if parsed and parsed.get("code"):
            results.append(parsed)
    return results


# ── Financial Data ────────────────────────────────────────────────────────

def get_finance(codes):
    """
    Fetch financial data for given stock codes.
    Returns dict: {code: {code, report_date, eps, revenue, net_profit, roe,
                          gross_margin, revenue_yoy, profit_yoy, bps}}
    """
    if not codes:
        return {}

    result = {}
    for code in codes:
        fin_data = _fetch_single_finance(code)
        if fin_data:
            result[fin_data["code"]] = fin_data
    return result


def _fetch_single_finance(code):
    """
    Fetch financial data for a single stock from Sina finance.
    """
    bare = strip_prefix(code)
    # Try sz first, then sh
    for node in ["sz", "sh"]:
        url = SINA_FINANCE_URL.format(node, bare)
        raw = fetch_url(url)
        if not raw:
            continue
        try:
            data = json.loads(raw)
            if isinstance(data, list) and len(data) > 0:
                item = data[0]
                return {
                    "code": bare,
                    "report_date": item.get("report_date", ""),
                    "eps": _safe_float(item.get("eps")),
                    "revenue": _safe_float(item.get("revenue")),
                    "net_profit": _safe_float(item.get("net_profit")),
                    "roe": _safe_float(item.get("roe")),
                    "gross_margin": _safe_float(item.get("gross_margin")),
                    "revenue_yoy": _safe_float(item.get("revenue_yoy")),
                    "profit_yoy": _safe_float(item.get("profit_yoy")),
                    "bps": _safe_float(item.get("bps")),
                }
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            logger.warning("_fetch_single_finance error for %s: %s", code, e)
            continue
    return None


# ── Self-test (when run directly) ─────────────────────────────────────────

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    print("=== china_stock.py self-test ===")
    print()

    # Test auto_prefix
    print("--- auto_prefix ---")
    for c in ["600519", "000001", "300750", "002594"]:
        print(f"  {c} -> {auto_prefix(c)}")

    print()
    print("--- search_stock('贵州茅台') ---")
    results = search_stock("贵州茅台")
    for r in results[:5]:
        print(f"  {r}")

    print()
    print("--- get_peers(['600519', '000858', '600809']) ---")
    peers = get_peers(["600519", "000858", "600809"])
    for p in peers:
        print(f"  {p.get('code')} {p.get('name')}: price={p.get('price')}, "
              f"change={p.get('change_pct')}%, vol={p.get('volume')}")

    print()
    print("--- get_quote('600519') ---")
    q = get_quote("600519")
    print(f"  name={q.get('name')}, price={q.get('price')}, "
          f"change={q.get('change_pct')}%")
    print(f"  ths={q.get('ths')}")

    print()
    print("--- get_history('600519', 5) ---")
    hist = get_history("600519", 5)
    for h in hist[:5]:
        print(f"  {h}")

    print()
    print("--- get_market_indexes() ---")
    idxs = get_market_indexes()
    for ix in idxs:
        print(f"  {ix.get('code')} {ix.get('name')}: {ix.get('price')}")

    print()
    print("--- get_finance(['600519', '000858']) ---")
    fin = get_finance(["600519", "000858"])
    for k, v in fin.items():
        print(f"  {k}: eps={v.get('eps')}, roe={v.get('roe')}")

    print()
    print("=== Done ===")
