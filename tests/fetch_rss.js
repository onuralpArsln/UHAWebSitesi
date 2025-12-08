const https = require('https');
const fs = require('fs');
const path = require('path');

const rssUrl = 'https://dhaabone.dha.com.tr/rss/1719/k9quL7DqdugGLn4kKrTMzmHbRWQN5JQZ4wfCwMuJiOE64o3-B7R_qu33sYG8kMYZHDqtewhItlDOPuc=';
const outputPath = path.join(__dirname, 'dha_rss.xml');

https.get(rssUrl, (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        fs.writeFileSync(outputPath, data);
        console.log('RSS feed saved to ' + outputPath);
    });
}).on('error', (err) => {
    console.error('Error fetching RSS:', err);
});
