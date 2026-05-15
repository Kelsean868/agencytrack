const admin = require('firebase-admin');
const serviceAccount = require('./service-account-key.json');

const NEW_PASSWORD = process.env.TEST_AGENT_PASSWORD;
if (!NEW_PASSWORD) {
  console.error('ERROR: TEST_AGENT_PASSWORD must be set in your shell before running this script.');
  console.error('PowerShell: $env:TEST_AGENT_PASSWORD="value"; node functions/set-agent-password.cjs');
  console.error('Bash:       TEST_AGENT_PASSWORD=value node functions/set-agent-password.cjs');
  console.error('See .env.example for documentation.');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

admin.auth().updateUser('J0j4uBqzTPcfm1IlGCPyDzo27RP2', {
  password: NEW_PASSWORD,
  emailVerified: true,
})
.then(() => { console.log('✅ Password set'); process.exit(); })
.catch(console.error);