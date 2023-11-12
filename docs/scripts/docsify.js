window.$docsify = {
    routerMode: 'history',
    homepage: 'introduction.md',
    loadSidebar: true,
    subMaxLevel: 3,
    auto2top: true,
    name: 'CASE Documentation',
    relativePath: true,
    repo: '',
    copyCode: {
      buttonText: 'Copy to clipboard',
      errorText: 'Error',
      successText: 'Copied'
    },
    plugins: [
      function (hook,vm) {
          hook.beforeEach(function (content) {
          // Regular expression to match front matter
          const frontMatterRegex = /^---\n([\s\S]+?)\n---/;
          const match = frontMatterRegex.exec(content);

          if (match) {
            const frontMatter = match[1];
            const lines = frontMatter.split('\n').filter(line => line.startsWith('meta-'));
            const metaInfo = {};

            lines.forEach(line => {
              const splitIndex = line.indexOf(':');
              if (splitIndex !== -1) {
                const key = line.substring(0, splitIndex).trim();
                const value = line.substring(splitIndex + 1).trim();
                metaInfo[key] = value;
              }
            });
            
          
            removeOldMetas();
            // Inject new meta tags
            Object.keys(metaInfo).forEach(key => {
              const metaTag = document.createElement('meta');
              metaTag.setAttribute('docsify-meta-info', ''); // Mark the tag for easy identification
              if (key.startsWith('meta-og-')) {
                metaTag.setAttribute('property', key.replace('meta-', ''));
              } else if (key.startsWith('meta-twitter-')) {
                metaTag.setAttribute('name', key.replace('meta-', ''));
              } else {
                metaTag.setAttribute('name', key.replace('meta-', ''));
              }
              metaTag.setAttribute('content', metaInfo[key]);
              document.head.appendChild(metaTag);
            });

            return content.replace(frontMatterRegex, '');
          }
          return content;
        });
      }
    ]
}



function removeOldMetas() {
  const existingMetaTags = document.querySelectorAll('meta[docsify-meta-info]');
  existingMetaTags.forEach(tag => tag.remove());
}
