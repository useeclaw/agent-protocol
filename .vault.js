#!/usr/bin/env node
/**
 * Credential Vault for Agent Protocol Project
 * 
 * Simple obfuscation: base64 + reverse + key char
 * Usage: 
 *   node .vault.js get google_pwd
 *   node .vault.js set google_pwd "newpassword"
 */

const fs = require('fs');
const path = require('path');

const VAULT_FILE = path.join(__dirname, '.vault.json');
const KEY_CHAR = 'X'; // Prefix added before base64

// Encode: reverse + add key + base64
function encode(text) {
  const reversed = text.split('').reverse().join('');
  const withKey = KEY_CHAR + reversed;
  return Buffer.from(withKey).toString('base64');
}

// Decode: base64 decode + remove key + reverse
function decode(encoded) {
  const withKey = Buffer.from(encoded, 'base64').toString('utf-8');
  const withoutKey = withKey.slice(1);
  return withoutKey.split('').reverse().join('');
}

// Load vault
function load() {
  try {
    if (fs.existsSync(VAULT_FILE)) {
      return JSON.parse(fs.readFileSync(VAULT_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to load vault:', e.message);
  }
  return {};
}

// Save vault
function save(data) {
  fs.writeFileSync(VAULT_FILE, JSON.stringify(data, null, 2) + '\n');
  fs.chmodSync(VAULT_FILE, 0o600); // Read/write for owner only
}

// Get value
function get(key) {
  const vault = load();
  const parts = key.split('_');
  let current = vault;
  
  for (const part of parts) {
    if (!current || typeof current !== 'object') {
      console.error(`Key not found: ${key}`);
      process.exit(1);
    }
    current = current[part];
  }
  
  if (typeof current === 'string' && current.startsWith('enc:')) {
    // It's encoded
    const decoded = decode(current.slice(4));
    console.log(decoded);
  } else {
    console.log(current || '');
  }
}

// Set value
function set(key, value) {
  const vault = load();
  const parts = key.split('_');
  let current = vault;
  
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  
  const lastPart = parts[parts.length - 1];
  current[lastPart] = 'enc:' + encode(value);
  
  save(vault);
  console.log(`✓ Saved ${key}`);
}

// List keys
function list() {
  const vault = load();
  
  function traverse(obj, prefix = '') {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}_${key}` : key;
      if (typeof value === 'object' && value !== null) {
        traverse(value, fullKey);
      } else {
        console.log(fullKey);
      }
    }
  }
  
  traverse(vault);
}

// Main
const command = process.argv[2];
const key = process.argv[3];
const value = process.argv[4];

switch (command) {
  case 'get':
    if (!key) {
      console.error('Usage: node .vault.js get <key>');
      process.exit(1);
    }
    get(key);
    break;
    
  case 'set':
    if (!key || !value) {
      console.error('Usage: node .vault.js set <key> <value>');
      process.exit(1);
    }
    set(key, value);
    break;
    
  case 'list':
    list();
    break;
    
  default:
    console.log('Credential Vault for Agent Protocol Project');
    console.log('');
    console.log('Usage:');
    console.log('  node .vault.js get <key>     - Get a credential');
    console.log('  node .vault.js set <key> <value> - Set a credential');
    console.log('  node .vault.js list          - List all keys');
    console.log('');
    console.log('Examples:');
    console.log('  node .vault.js get google_email');
    console.log('  node .vault.js get google_pwd');
    console.log('  node .vault.js set moltbook_api_key "moltbook_sk_xxx"');
}
