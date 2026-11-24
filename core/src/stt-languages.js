'use strict';

// whisper.cpp's g_lang table (100 codes).
const WHISPER_LANGUAGES = new Set(('en zh de es ru ko fr ja pt tr pl ca nl ar sv it id hi fi vi he uk el ms cs ro da hu ta no th ur hr bg ' +
  'lt la mi ml cy sk te fa lv bn sr az sl kn et mk br eu is hy ne mn bs kk sq sw gl mr pa si km sn yo so af oc ka be tg sd gu am yi lo uz ' +
  'fo ht ps tk nn mt sa lb my bo tl mg as tt haw ln ha ba jw su yue').split(' '));

// BCP-47 tag to a Whisper code by its primary subtag; null when unsupported.
function toWhisperLanguage(tag) {
  if (typeof tag !== 'string') return null;
  const primary = tag.split('-')[0].toLowerCase();
  return WHISPER_LANGUAGES.has(primary) ? primary : null;
}

module.exports = { WHISPER_LANGUAGES, toWhisperLanguage };
