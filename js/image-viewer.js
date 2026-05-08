// Image viewer module (separate from index scripts)
const IMAGE_PATH = 'assets/png_jpg/';
const DEFAULT_PATTERN = '{section}-test{test}-{n}'; // Pattern: reading-test1-01, reading-test1-02, etc.
const MAX_ATTEMPTS = 14; // max images to try per section
const VIEWER_SECTIONS = ['reading', 'listening', 'writing', 'speaking'];
let activeLoadToken = 0;

function el(sel){return document.querySelector(sel)}

function makeImg(src){
  return new Promise((resolve,reject)=>{
    const img = new Image();
    img.onload = ()=>resolve(img);
    img.onerror = ()=>reject(src);
    img.src = src;
  });
}

function clampZoom(value){
  return Math.max(0.5, Math.min(2.5, Number(value) || 1));
}

function applyZoom(container, zoomLevel){
  container.style.setProperty('--viewer-zoom', String(clampZoom(zoomLevel)));
}

async function probeImagesForPattern(test, section, pattern){
  const found = [];
  for(let n=1;n<=MAX_ATTEMPTS;n++){
    const indexVariants = [String(n).padStart(2, '0'), String(n)];
    let matched = false;

    for (const indexValue of indexVariants) {
      const filename = pattern
        .replace('{section}', section)
        .replace('{test}', test)
        .replace('{n}', indexValue) + '.png';
      const src = IMAGE_PATH + 'test' + test + '/' + filename;

      try{
        await makeImg(src);
        found.push({src,filename});
        matched = true;
        break;
      }catch(e){
        // try the next index format
      }
    }

    if (!matched && found.length > 0) {
      break;
    }
  }

  return found;
}

function renderViewer(container, sections){
  const wrap = container;
  wrap.innerHTML = '';
  if(!sections || sections.length===0){
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = 'flex';
  let zoomLevel = 1;

  const handleWheelZoom = (event) => {
    if(!event.ctrlKey) return;
    event.preventDefault();
    const direction = event.deltaY > 0 ? -0.1 : 0.1;
    updateZoom(zoomLevel + direction);
  };

  const controls = document.createElement('div');
  controls.className = 'image-viewer-controls-top';

  const zoomOutBtn = document.createElement('button');
  zoomOutBtn.type = 'button';
  zoomOutBtn.textContent = '−';
  zoomOutBtn.className = 'image-viewer-btn-zoom';

  const zoomLabel = document.createElement('span');
  zoomLabel.className = 'image-viewer-counter';

  const zoomResetBtn = document.createElement('button');
  zoomResetBtn.type = 'button';
  zoomResetBtn.textContent = '100%';
  zoomResetBtn.className = 'image-viewer-btn-zoom';

  const zoomInBtn = document.createElement('button');
  zoomInBtn.type = 'button';
  zoomInBtn.textContent = '+';
  zoomInBtn.className = 'image-viewer-btn-zoom';

  const updateZoom = (nextZoom) => {
    zoomLevel = clampZoom(nextZoom);
    applyZoom(wrap, zoomLevel);
    zoomLabel.textContent = `${Math.round(zoomLevel * 100)}%`;
  };

  zoomOutBtn.onclick = () => updateZoom(zoomLevel - 0.1);
  zoomResetBtn.onclick = () => updateZoom(1);
  zoomInBtn.onclick = () => updateZoom(zoomLevel + 0.1);

  controls.appendChild(zoomOutBtn);
  controls.appendChild(zoomLabel);
  controls.appendChild(zoomResetBtn);
  controls.appendChild(zoomInBtn);

  wrap.appendChild(controls);
  wrap.addEventListener('wheel', handleWheelZoom, { passive: false });
  applyZoom(wrap, zoomLevel);
  zoomLabel.textContent = '100%';

  sections.forEach((section) => {
    const sectionTitle = document.createElement('h3');
    sectionTitle.className = 'image-viewer-section-title';
    sectionTitle.textContent = section.title;
    wrap.appendChild(sectionTitle);

    const gallery = document.createElement('div');
    gallery.className = 'image-viewer-gallery';

    section.images.forEach((img) => {
      const imgWrapper = document.createElement('div');
      imgWrapper.className = 'image-viewer-item';

      const imgEl = document.createElement('img');
      imgEl.src = img.src;
      imgEl.alt = img.filename;
      imgEl.className = 'image-viewer-page';

      imgWrapper.appendChild(imgEl);
      gallery.appendChild(imgWrapper);
    });

    if (section.images.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'image-viewer-empty-section';
      emptyState.textContent = 'Chưa có ảnh cho phần này';
      gallery.appendChild(emptyState);
    }

    wrap.appendChild(gallery);
  });
}

async function loadForTest(test){
  const container = el('#image-viewer');
  if(!container) return;
  const loadToken = ++activeLoadToken;
  const pattern = container.dataset.pattern || DEFAULT_PATTERN;
  const sectionResults = await Promise.all(
    VIEWER_SECTIONS.map(async (section) => {
      const images = await probeImagesForPattern(test, section, pattern);
      if (images.length === 0) return null;
      return {
        key: section,
        title: section.charAt(0).toUpperCase() + section.slice(1),
        images,
      };
    })
  );

  if (loadToken !== activeLoadToken) return;

  const sections = sectionResults.filter(Boolean);

  renderViewer(container, sections);
}

function bindSelectors(){
  const selector = el('#test-selector');
  if(selector) selector.addEventListener('change', ()=> loadForTest(selector.value));
  // initial load
  const initial = selector ? selector.value : '1';
  loadForTest(initial);
}

document.addEventListener('DOMContentLoaded', ()=>{
  try{ bindSelectors() }catch(e){console.warn('image-viewer init failed', e)}
});

// Attach to window for use in other scripts
window.loadForTest = loadForTest;
