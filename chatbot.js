/* The same Chatbase assistant on every SmartApply page. */
(() => {
  const chatbotId = 'ODMZuG5qcv8tuS54TBbRV';
  if (document.getElementById(chatbotId)) return;
  if (window.chatbase?.('getState') === 'initialized') return;

  if (!window.chatbase) {
    const queue = (...args) => {
      queue.q ||= [];
      queue.q.push(args);
    };
    window.chatbase = new Proxy(queue, {
      get(target, property) {
        if (property === 'q') return target.q;
        return (...args) => target(property, ...args);
      }
    });
  }

  const load = () => {
    if (document.getElementById(chatbotId)) return;
    const script = document.createElement('script');
    script.src = 'https://www.chatbase.co/embed.min.js';
    script.id = chatbotId;
    script.domain = 'www.chatbase.co';
    document.body.appendChild(script);
  };
  if (document.readyState === 'complete') load();
  else window.addEventListener('load', load, { once: true });
})();
