const fs = require('fs');
const path = require('path');
const https = require('https');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

// Initialize Ajv
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

// Load schemas
const modsListSchema = JSON.parse(fs.readFileSync('mods.schema.json', 'utf8'));
const dsktSchema = JSON.parse(fs.readFileSync('dskt.schema.json', 'utf8'));

// Compile schemas
const validateModsList = ajv.compile(modsListSchema);
const validateDskt = ajv.compile(dsktSchema);

// Validate function for dskt.json
async function validateDsktJson(repo) {
  return new Promise((resolve, reject) => {
    const [owner, name] = repo.replace('https://github.com/', '').split('/');
    const options = {
      hostname: 'raw.githubusercontent.com',
      path: `/${owner}/${name}/main/dskt.json`,
      headers: {
        'User-Agent': 'Node.js'
      }
    };

    https.get(options, (res) => {
      if (res.statusCode === 404) {
        reject(new Error(`dskt.json not found in repository: ${repo}`));
        return;
      }

      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const dsktJson = JSON.parse(data);
          
          // Validate against schema
          if (!validateDskt(dsktJson)) {
            const errors = validateDskt.errors.map(err => 
              `${err.instancePath} ${err.message}`
            ).join('\n');
            reject(new Error(`Invalid dskt.json schema in repository ${repo}:\n${errors}`));
            return;
          }

          resolve(dsktJson);
        } catch (error) {
          reject(new Error(`Invalid JSON in dskt.json for repository: ${repo}`));
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

async function main() {
  try {
    // Read and validate mods.json
    const mods = JSON.parse(fs.readFileSync('mods.json', 'utf8'));
    
    if (!validateModsList(mods)) {
      const errors = validateModsList.errors.map(err => 
        `${err.instancePath} ${err.message}`
      ).join('\n');
      throw new Error(`Invalid mods.json schema:\n${errors}`);
    }
    
    // Validate each repository's dskt.json
    const validationPromises = mods.map(async (mod) => {
      try {
        const dsktJson = await validateDsktJson(mod.repo);
        console.log(`✓ Validated ${mod.name} (${mod.repo})`);
        
        // Additional validation: check if name matches
        if (dsktJson.name !== mod.name) {
          console.error(`✗ Name mismatch for ${mod.name}: dskt.json name is ${dsktJson.name}`);
          return false;
        }
        
        return true;
      } catch (error) {
        console.error(`✗ Failed to validate ${mod.name}: ${error.message}`);
        return false;
      }
    });

    const results = await Promise.all(validationPromises);
    
    if (results.includes(false)) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Validation failed:', error);
    process.exit(1);
  }
}

main();
