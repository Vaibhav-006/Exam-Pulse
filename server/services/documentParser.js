import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

export async function parseDocument(filePath, mimetype, ext) {
  const content = fs.readFileSync(filePath);

  if (ext === '.txt') {
    return content.toString('utf-8');
  }

  if (ext === '.pdf') {
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(content);
      return data.text;
    } catch (err) {
      throw new Error('Failed to parse PDF: ' + err.message);
    }
  }

  if (ext === '.docx') {
    try {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer: content });
      return result.value;
    } catch (err) {
      throw new Error('Failed to parse DOCX: ' + err.message);
    }
  }

  throw new Error('Unsupported file type: ' + ext);
}
