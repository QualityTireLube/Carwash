const fs = require('fs');
const path = require('path');

console.log('🔍 Checking for potential build issues...\n');

// Check if all required files exist
const requiredFiles = [
  'src/app/layout.tsx',
  'src/app/page.tsx',
  'src/app/globals.css',
  'src/components/WashButtons.tsx',
  'src/components/LoadingSpinner.tsx',
  'src/utils/api.ts',
  'next.config.js',
  'tailwind.config.js',
  'postcss.config.js',
  'tsconfig.json',
  'package.json'
];

let allFilesExist = true;
requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    allFilesExist = false;
  }
});

console.log('\n📦 Checking package.json...');
try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  
  // Check required dependencies
  const requiredDeps = ['next', 'react', 'react-dom'];
  const requiredDevDeps = ['typescript', '@types/react', '@types/node'];
  
  console.log('Dependencies:');
  requiredDeps.forEach(dep => {
    if (packageJson.dependencies && packageJson.dependencies[dep]) {
      console.log(`  ✅ ${dep}: ${packageJson.dependencies[dep]}`);
    } else {
      console.log(`  ❌ ${dep}: MISSING`);
      allFilesExist = false;
    }
  });
  
  console.log('Dev Dependencies:');
  requiredDevDeps.forEach(dep => {
    if (packageJson.devDependencies && packageJson.devDependencies[dep]) {
      console.log(`  ✅ ${dep}: ${packageJson.devDependencies[dep]}`);
    } else {
      console.log(`  ❌ ${dep}: MISSING`);
      allFilesExist = false;
    }
  });
  
  // Check scripts
  console.log('Scripts:');
  const requiredScripts = ['dev', 'build', 'start'];
  requiredScripts.forEach(script => {
    if (packageJson.scripts && packageJson.scripts[script]) {
      console.log(`  ✅ ${script}: ${packageJson.scripts[script]}`);
    } else {
      console.log(`  ❌ ${script}: MISSING`);
      allFilesExist = false;
    }
  });
  
} catch (error) {
  console.log(`❌ Error reading package.json: ${error.message}`);
  allFilesExist = false;
}

console.log('\n🎯 Summary:');
if (allFilesExist) {
  console.log('✅ All checks passed! The build should work on Vercel.');
} else {
  console.log('❌ Some issues found. Please fix them before deploying.');
}

console.log('\n💡 Note: This script only checks for obvious issues.');
console.log('   The actual build might still fail due to other reasons.'); 