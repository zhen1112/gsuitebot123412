// deletegsuite.js
const { google } = require('googleapis');
const key = require('./service-account.json');
const { getExpiredGsuiteUsers, editGsuiteUserDeleted } = require('./apicurl');

const ADMIN_EMAIL = 'adminsuper@nernir.com';

async function deleteGsuiteUser(email) {
  const auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ['https://www.googleapis.com/auth/admin.directory.user'],
    subject: ADMIN_EMAIL,
  });

  const service = google.admin({ version: 'directory_v1', auth });

  try {
    await service.users.delete({ userKey: email });
    console.log(`✅ GSuite user deleted: ${email}`);
    return true;
  } catch (err) {
    console.error(`❌ Failed to delete user ${email}: ${err.message}`);
    return false;
  }
}

async function deleteExpiredGsuite() {
  try {
    const expiredUsers = await getExpiredGsuiteUsers();
    if (!expiredUsers.length) {
      console.log('ℹ️ Tidak ada user GSuite yang expired.');
      return;
    }

    for (const user of expiredUsers) {
      const { email } = user;
      const success = await deleteGsuiteUser(email);
      if (success) {
        await editGsuiteUserDeleted(email, true);
        console.log(`🗑️ Marked user as deleted in DB: ${email}`);
      }
    }
  } catch (err) {
    console.error('❌ Error in deleteExpiredGsuite:', err.message);
  }
}

module.exports = { deleteExpiredGsuite };
