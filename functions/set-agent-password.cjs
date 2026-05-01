const admin = require('firebase-admin');
const serviceAccount = require('./service-account-key.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

admin.auth().updateUser('J0j4uBqzTPcfm1IlGCPyDzo27RP2', {
  password: 'AgentTest123!',
  emailVerified: true,
})
.then(() => { console.log('✅ Password set'); process.exit(); })
.catch(console.error);