from flask import Flask, request, jsonify
import os

app = Flask(__name__)

@app.route('/saveExcelFile', methods=['POST'])
def save_excel_file():
    file_name = request.args.get('fileName')
    file_data = request.data
    file_path = os.path.join(r'C:\EJS\Updated Front End\KCLAS\public\files', file_name)
    try:
        with open(file_path, 'wb') as f:
            f.write(file_data)
        return jsonify({"message": "File saved successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=3000)
