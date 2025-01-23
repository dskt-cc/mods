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
    // Read current and previous mods.json
    const currentMods = JSON.parse(fs.readFileSync('mods.json', 'utf8'));
    
    // Get the most recently added mod (last in the array)
    const newMod = currentMods[currentMods.length - 1];
    
    console.log(`Validating newest mod: ${newMod.name}`);
    
    try {
      const dsktJson = await validateDsktJson(newMod.repo);
      console.log(`✓ Validated ${newMod.name} (${newMod.repo})`);
      
      // Check if name matches
      if (dsktJson.name !== newMod.name) {
        console.error(`✗ Name mismatch for ${newMod.name}: dskt.json name is ${dsktJson.name}`);
        process.exit(1);
      }
      
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
