import { parse } from 'pgsql-ast-parser';
import fs from 'fs';

try {
  const sql = fs.readFileSync('database/schema.sql', 'utf8');
  parse(sql);
  console.log('No syntax errors found!');
} catch (e) {
  console.error(e.message);
}
