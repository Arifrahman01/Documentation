const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const BASE_DIR = 'D:/Jhonlin/SAP/SAC/Document';
const folders = fs.readdirSync(BASE_DIR).filter(f => fs.statSync(path.join(BASE_DIR, f)).isDirectory());

const result = {};

for (const folder of folders) {
  const folderPath = path.join(BASE_DIR, folder);
  const excelFiles = fs.readdirSync(folderPath).filter(f => f.startsWith('Story Builder Spec') && f.endsWith('.xlsx'));
  
  result[folder] = [];
  for (const ef of excelFiles) {
    const fullPath = path.join(folderPath, ef);
    const wb = XLSX.readFile(fullPath);
    const fileInfo = {
      file: ef,
      sheets: []
    };

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
      fileInfo.sheets.push({
        name: sheetName,
        rowCount: data.length,
        header: data[0] || []
      });
    }
    result[folder].push(fileInfo);
  }
}

console.log(JSON.stringify(result, null, 2));
