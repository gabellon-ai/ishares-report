const jsonUrl = new URL('funds.json', import.meta.env.BASE_URL).toString() + '?ts=' + Date.now();
fetch(jsonUrl).then(r => r.json()).then(setRows);
