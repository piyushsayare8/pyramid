import { execSync } from 'child_process';

console.log('🚀 Deploying Pyramid to Production...\n');

// 1. Deploy Backend API
console.log('📡 Deploying Backend API...');
execSync('npm run deploy-api', { stdio: 'inherit' });

// 2. Deploy Frontend  
console.log('\n🌐 Deploying Frontend...');
execSync('npm run deploy-frontend', { stdio: 'inherit' });

console.log('\n✅ Deployment Complete!');
console.log('🔗 Backend: https://pyramid-api.piyushsayare8.workers.dev');
console.log('🏠 Frontend: https://main.pyramid-5050.pages.dev');
