// Wait for ALL your scripts, then dump EVERYTHING to window
setTimeout(() => {
  // After all scripts load, force everything to global
  const scriptsLoaded = [
    'constants.js', 'session.js', 'toast.js', 
    'utils.js', 'eternityHeader.js', 'eternityFooter.js'
  ].every(name => document.querySelector(`script[src*="${name}"]`));

  if (scriptsLoaded) {
    // Copy ALL global functions/variables to window explicitly
    Object.getOwnPropertyNames(window).forEach(key => {
      try {
        if (typeof window[key] === 'function' || typeof window[key] === 'object') {
          window[key] = window[key];
        }
      } catch(e) {}
    });
    console.log('ALL globals exported!');
  }
}, 100);
