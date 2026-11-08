const fs = require('fs');
const code = fs.readFileSync('src/App.jsx', 'utf8');
const lines = code.split('\n');

// Count function-level braces (top-level of App function, starting from line 5)
// We need to find where `function App() {` opens and track when it closes
let braceDepth = 0;
let parenDepth = 0;
let foundAppStart = false;
let appCloseLine = -1;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (!foundAppStart && line.includes('function App()')) {
    foundAppStart = true;
  }
  
  if (!foundAppStart) continue;
  
  // Count braces/parens in this line (naive but useful for indentation-based code)
  for (let j = 0; j < line.length; j++) {
    const c = line[j];
    if (c === '{') braceDepth++;
    if (c === '}') {
      braceDepth--;
      if (braceDepth === 0) {
        console.log('App function closes at line ' + (i+1) + ' (brace depth reaches 0)');
        if (appCloseLine === -1) appCloseLine = i+1;
      }
      if (braceDepth < 0) {
        console.log('NEGATIVE brace depth at line ' + (i+1) + '! Extra closing brace.');
      }
    }
    if (c === '(') parenDepth++;
    if (c === ')') {
      parenDepth--;
      if (parenDepth < 0) {
        console.log('NEGATIVE paren depth at line ' + (i+1) + '! Extra closing paren.');
      }
    }
  }
}

console.log('\nFinal brace depth: ' + braceDepth);
console.log('Final paren depth: ' + parenDepth);
console.log('Total lines: ' + lines.length);
