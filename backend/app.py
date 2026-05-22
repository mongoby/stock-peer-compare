import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, request, jsonify
from flask_cors import CORS

from china_stock import (
    search_stock,
    get_peers,
    get_quote,
    get_history,
    get_market_indexes,
    get_finance,
)

app = Flask(__name__)
CORS(app)


@app.route('/api/search', methods=['GET'])
def api_search():
    q = request.args.get('q', '')
    if not q:
        return jsonify({'results': []})
    try:
        results = search_stock(q)
        return jsonify({'results': results})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/peers', methods=['POST'])
def api_peers():
    data = request.get_json(force=True)
    codes = data.get('codes', [])
    if not codes:
        return jsonify({'results': []})
    try:
        results = get_peers(codes)
        return jsonify({'results': results})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/quote', methods=['GET'])
def api_quote():
    code = request.args.get('code', '')
    if not code:
        return jsonify({'error': 'code is required'}), 400
    try:
        detail = get_quote(code)
        return jsonify(detail)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/history', methods=['GET'])
def api_history():
    code = request.args.get('code', '')
    days = request.args.get('days', 60, type=int)
    if not code:
        return jsonify({'error': 'code is required'}), 400
    try:
        klines = get_history(code, days)
        return jsonify({'klines': klines})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/market', methods=['GET'])
def api_market():
    try:
        indices = get_market_indexes()
        return jsonify({'indices': indices})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/finance', methods=['POST'])
def api_finance():
    data = request.get_json(force=True)
    codes = data.get('codes', [])
    if not codes:
        return jsonify({'results': {}})
    try:
        results = get_finance(codes)
        return jsonify({'results': results})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
