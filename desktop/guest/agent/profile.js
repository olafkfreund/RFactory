'use strict';

const DIR = '/run/rfactory/profile';
const MAPPER = 'rfprofile';

// exec(cmd, argv, { input }) -> Promise. The key goes only on stdin, never argv or env.
// The key arrives base64 so binary key files survive JSON; it is passed on as the raw bytes.
function createProfile(exec) {
  let attached = false;
  return {
    get attached() { return attached; },
    async attach(key) {
      if (attached) throw new Error('profile already attached');
      await exec('cryptsetup', ['open', '--key-file=-', '/dev/vdb', MAPPER], { input: Buffer.from(key, 'base64') });
      try {
        // blkid exits 2 only when the device holds no signature: a new profile, so make its filesystem.
        // Any other failure must not format (it could be existing data).
        await exec('blkid', ['-p', `/dev/mapper/${MAPPER}`]).catch(async (e) => {
          if (e?.code !== 2) throw e;
          await exec('mkfs.ext4', ['-q', `/dev/mapper/${MAPPER}`]);
        });
        await exec('mkdir', ['-p', DIR]);
        await exec('mount', ['-o', 'nodev,nosuid,noexec', `/dev/mapper/${MAPPER}`, DIR]);
        await exec('mkdir', ['-p', `${DIR}/chrome`]);
        await exec('chown', ['rfchrome:rfchrome', `${DIR}/chrome`]); // the control Chrome is not root
      } catch (e) {
        await exec('cryptsetup', ['close', MAPPER]).catch(() => {});
        throw e;
      }
      attached = true;
      return `${DIR}/chrome`;
    },
    // The caller closes Chrome first; then unmount, then close the mapping.
    async detach() {
      if (!attached) return;
      attached = false;
      try { await exec('umount', [DIR]); } finally { await exec('cryptsetup', ['close', MAPPER]); }
    },
  };
}

module.exports = { createProfile, DIR };
