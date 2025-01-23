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

async function getDefaultBranch(owner, name) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${owner}/${name}`,
      headers: {
        'User-Agent': 'Node.js',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const repoData = JSON.parse(data);
          if (repoData.default_branch) {
            resolve(repoData.default_branch);
          } else {
            reject(new Error('Could not determine default branch'));
          }
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

async function fetchDsktJson(owner, name, branch) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'raw.githubusercontent.com',
      path: `/${owner}/${name}/${branch}/dskt.json`,
      headers: {
        'User-Agent': 'Node.js'
      }
    };

    console.log(`Checking ${branch} branch at: ${options.hostname}${options.path}`);

    https.get(options, (res) => {
      if (res.statusCode === 404) {
        reject(new Error('Not found'));
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
  const [owner, name] = repo.replace('https://github.com/', '').split('/');
  
  // Try to get the default branch first
  try {
    const defaultBranch = await getDefaultBranch(owner, name);
    console.log(`Detected default branch: ${defaultBranch}`);
    
    try {
      const dsktJson = await fetchDsktJson(owner, name, defaultBranch);
      
      if (!validateDskt(dsktJson)) {
        const errors = validateDskt.errors.map(err => 
          `${err.instancePath} ${err.message}`
        ).join('\n');
        throw new Error(`Invalid dskt.json schema:\n${errors}`);
      }

      return dsktJson;
    } catch (error) {
      console.log(`Not found in default branch (${defaultBranch}), trying fallback branches...`);
    }
  } catch (error) {
    console.log('Could not determine default branch, trying fallback branches...');
  }

  // Fallback to checking common branch names
  const fallbackBranches = ['main', 'master', 'development', 'dev'];
  
  for (const branch of fallbackBranches) {
    try {
      const dsktJson = await fetchDsktJson(owner, name, branch);
      
      if (!validateDskt(dsktJson)) {
        const errors = validateDskt.errors.map(err => 
          `${err.instancePath} ${err.message}`
        ).join('\n');
        throw new Error(`Invalid dskt.json schema:\n${errors}`);
      }

      return dsktJson;
    } catch (error) {
      if (branch === fallbackBranches[fallbackBranches.length - 1]) {
        throw new Error(`dskt.json not found in repository (tried branches: ${fallbackBranches.join(', ')}): ${repo}`);
      }
      console.log(`Not found in ${branch} branch, trying next...`);
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
