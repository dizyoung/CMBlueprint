// Small shared header so a parent never feels stranded on a separate page.
// Static markup only — no routing, no framework.
export function appHeaderHTML(activePage) {
  function link(href, label, page) {
    return '<a href="' + href + '"' + (page === activePage ? ' class="active"' : '') + '>' + label + '</a>';
  }
  return (
    '<header class="app-header"><div class="app-header-inner">' +
      '<span class="app-brand">Family School Map</span>' +
      '<nav class="app-nav">' +
        link('./index.html', 'Home', 'home') +
        link('./family-school-map.html', 'Family School Map', 'map') +
        link('./weekly-rhythm.html', 'Weekly Rhythm', 'rhythm') +
      '</nav>' +
    '</div></header>'
  );
}
