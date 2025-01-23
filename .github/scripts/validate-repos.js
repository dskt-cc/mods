const fs = require('fs');
const https = require('https');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

// Initialize Ajv
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

// Load schemas
const dsktSchema = JSON.parse(fs.readFileSync('dskt.schema.json', 'utf8'));
const validateDskt = ajv.compile(dsktSchema);

async function fetchDsktJson(repo, branch) {
  return new Promise((resolve, reject) => {
    const url = `https://raw.githubusercontent.com/${repo.replace('https://github.com/', '')}/refs/heads/${branch}/dskt.json`;
    console.log(`Checking: ${url}`);

    https.get(url, (res) => {
      if (res.statusCode === 404) {
        reject(new Error(`Not found at ${url}`));
        return;
      }

      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const dsktJson = JSON.parse(data);
          resolve(dsktJson);
        } catch (error) {
          reject(new Error('Invalid JSON'));
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

async function validateDsktJson(repo) {
  // Try main then master
  for (const branch of ['main', 'master']) {
    try {
      const dsktJson = await fetchDsktJson(repo, branch);
      
      if (!validateDskt(dsktJson)) {
        const errors = validateDskt.errors.map(err => 
          `${err.instancePath} ${err.message}`
        ).join('\n');
        throw new Error(`Invalid dskt.json schema:\n${errors}`);
      }

      return dsktJson;
    } catch (error) {
      console.log(`Failed ${branch}: ${error.message}`);
      if (branch === 'master') {
        throw new Error('dskt.json validation failed - check schema requirements');
      }
    }
  }
}

async function main() {
  try {
    const currentMods = JSON.parse(fs.readFileSync('mods.json', 'utf8'));
    const newMod = currentMods[currentMods.length - 1];
    
    console.log(`Validating newest mod: ${newMod.name}`);
    
    try {
      const dsktJson = await validateDsktJson(newMod.repo);
      console.log(`✓ Validated ${newMod.name} (${newMod.repo})`);
      
    } catch (error) {
      console.error(`✗ Failed to validate ${newMod.name}: ${error.message}`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('Validation failed:', error);
    process.exit(1);
  }
}

main();
