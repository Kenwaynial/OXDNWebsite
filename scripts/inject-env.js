const fs = require('fs');
const path = require('path');

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create the injection script
const envScript = `
<script>
  window.__SUPABASE_URL__ = "${supabaseUrl}";
  window.__SUPABASE_ANON_KEY__ = "${supabaseAnonKey}";
</script>
`;

// Function to inject the script into HTML files
function injectEnvVariables(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const injectedContent = content.replace('</head>', `${envScript}</head>`);
  fs.writeFileSync(filePath, injectedContent);
}

// Process all HTML files
const htmlDir = path.join(__dirname, 'html');
function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (path.extname(file) === '.html') {
      injectEnvVariables(fullPath);
    }
  });
}

processDirectory(htmlDir);
