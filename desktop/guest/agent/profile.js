'use strict';

const DIR = '/run/rfactory/profile';
const MAPPER = 'rfprofile';

// exec(cmd, argv, { input }) -> Promise. The key goes only on stdin, never argv or env.
function createProfile(exec) {
  let attached = false;
  return {
    get attached() { return attached; },
    async attach(key) {
      if (attached) throw new Error('profile already attached');
      await exec('cryptsetup', ['open', '--key-file=-', '/dev/vdb', MAPPER], { input: key });
      try {
        await exec('mkdir', ['-p', DIR]);
        await exec('mount', ['-o', 'nodev,nosuid,noexec', `/dev/mapper/${MAPPER}`, DIR]);
        await exec('mkdir', ['-p', `${DIR}/chrome`]);
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
