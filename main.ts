import { startService, stopService, serviceStatus } from './src/background';

const command = process.argv[2];

switch (command) {
    case 'start':
        startService();
        break;
    case 'stop':
        stopService();
        break;
    case 'status':
        console.log(`Service status: ${serviceStatus()}`);
        break;
    default:
        console.log('Usage: npm run service [start|stop|status]');
        process.exit(1);
}