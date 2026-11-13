import { createCommandMenu, createDialog, createTabs, createToasts } from './signal-ui.js';

const $ = (selector) => document.querySelector(selector);
const toast = createToasts({ duration: 4500 });
let currentComponent = 'command-menu';
let currentView = 'preview';
const platformKey = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ K' : 'Ctrl K';
$('#global-search kbd').textContent = platformKey;
$('#hero-command kbd').textContent = platformKey;
$('#playground-command kbd').textContent = platformKey;

function state(message) {
  $('#demo-state').textContent = message;
  $('#demo-announcement').textContent = message;
}

const snippets = {
  'command-menu': `<link rel="stylesheet" href="./signal-ui.css">
<button id="find-action" type="button">Find an action</button>

<script type="module">
  import { createCommandMenu } from './signal-ui.js';

  const menu = createCommandMenu({
    trigger: document.querySelector('#find-action'),
    commands: [
      {
        id: 'new-project',
        label: 'New project',
        description: 'Start with a clean workspace',
        keywords: ['create', 'workspace'],
        onSelect: () => console.log('New project selected')
      },
      {
        id: 'settings',
        label: 'Project settings',
        onSelect: () => console.log('Settings selected')
      }
    ]
  });

  // Call menu.destroy() when this view unmounts.
</script>`,
  tabs: `<link rel="stylesheet" href="./signal-ui.css">
<div id="project-tabs" class="sg-tabs">
  <div role="tablist" aria-label="Project views">
    <button role="tab" id="overview-tab"
      aria-controls="overview-panel"
      aria-selected="true">Overview</button>
    <button role="tab" id="activity-tab"
      aria-controls="activity-panel"
      aria-selected="false" tabindex="-1">Activity</button>
  </div>
  <div role="tabpanel" id="overview-panel"
    aria-labelledby="overview-tab" tabindex="0">
    Your project overview.
  </div>
  <div role="tabpanel" id="activity-panel"
    aria-labelledby="activity-tab" tabindex="0" hidden>
    Your latest activity.
  </div>
</div>

<script type="module">
  import { createTabs } from './signal-ui.js';
  const tabs = createTabs(document.querySelector('#project-tabs'), {
    onChange: ({ id }) => console.log('Active tab:', id)
  });
  // tabs.select('activity-tab');
  // Call tabs.destroy() when this view unmounts.
</script>`,
  dialog: `<link rel="stylesheet" href="./signal-ui.css">
<button id="review" type="button">Review changes</button>

<script type="module">
  import { createDialog, createToasts } from './signal-ui.js';
  const messages = createToasts();

  const review = createDialog({
    trigger: document.querySelector('#review'),
    title: 'Keep these changes?',
    description: 'You can review them before continuing.',
    confirmLabel: 'Keep changes',
    cancelLabel: 'Go back',
    onConfirm: () => messages.show({
      title: 'Changes confirmed',
      variant: 'success'
    })
  });
  // The dialog closes before onConfirm runs.
  // Call review.destroy() and messages.destroy() on unmount.
</script>`,
  toasts: `<link rel="stylesheet" href="./signal-ui.css">
<button id="save" type="button">Save preferences</button>

<script type="module">
  import { createToasts } from './signal-ui.js';

  const messages = createToasts({ duration: 4500 });
  document.querySelector('#save').addEventListener('click', () => {
    messages.show({
      title: 'Preferences saved',
      description: 'Your workspace is up to date.',
      variant: 'success',
      action: {
        label: 'Undo',
        onClick: () => console.log('Restore previous preferences')
      }
    });
  });
  // A message with an action stays until dismissed by default.
  // messages.dismiss(id); messages.destroy();
</script>`
};

const descriptions = {
  'command-menu': {
    index: '01', title: 'Command menu',
    description: 'Find an action without finding your way through the whole interface.',
    rationale: 'A searchable action list gives people another way to navigate, with the keyboard or a pointer.',
    keyboard: '<kbd>↑</kbd> <kbd>↓</kbd> move <kbd>Enter</kbd> choose <kbd>Esc</kbd> close'
  },
  tabs: {
    index: '02', title: 'Tabs',
    description: 'Keep related views together, while giving each one a clear place.',
    rationale: 'Switching views should preserve context. Manual activation lets people explore the tab labels before changing the panel.',
    keyboard: '<kbd>←</kbd> <kbd>→</kbd> focus <kbd>Enter</kbd> or <kbd>Space</kbd> activate'
  },
  dialog: {
    index: '03', title: 'Dialog',
    description: 'Give an important decision room to be understood before moving on.',
    rationale: 'A focused confirmation makes the action and its consequences clear. Closing returns people to where they were.',
    keyboard: '<kbd>Tab</kbd> move inside <kbd>Esc</kbd> cancel · focus returns on close'
  },
  toasts: {
    index: '04', title: 'Toast stack',
    description: 'Let people know what happened, without getting in the way of what comes next.',
    rationale: 'Keep feedback concise. Messages with actions remain available until dismissed; timed messages pause on hover or keyboard focus.',
    keyboard: '<kbd>Tab</kbd> reach actions · named close buttons · status announcements'
  }
};

function setView(view) {
  currentView = view;
  $('#preview-pane').hidden = view !== 'preview';
  $('#code-pane').hidden = view !== 'code';
  for (const button of document.querySelectorAll('.view-switch button')) {
    const selected = button.id === `show-${view}`;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  }
}

function selectComponent(id, { scroll = false, updateURL = true } = {}) {
  if (!descriptions[id]) return;
  currentComponent = id;
  const detail = descriptions[id];
  for (const button of document.querySelectorAll('[data-component]')) {
    const selected = button.dataset.component === id;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  }
  for (const panel of document.querySelectorAll('[data-demo]')) panel.hidden = panel.dataset.demo !== id;
  $('#detail-index').textContent = `COMPONENT / ${detail.index}`;
  $('#component-title').textContent = detail.title;
  $('#component-description').textContent = detail.description;
  $('#component-rationale').textContent = detail.rationale;
  // These fixed, authored keyboard labels never contain user-supplied content.
  $('#component-keyboard').innerHTML = detail.keyboard;
  $('#component-code').textContent = snippets[id];
  $('.code-topline > span').textContent = 'HTML + JAVASCRIPT / ES MODULE';
  state('Ready when you are');
  setView('preview');
  if (updateURL) history.replaceState(null, '', `#${id}`);
  if (scroll) $('#components').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}

for (const button of document.querySelectorAll('[data-component]')) button.addEventListener('click', () => selectComponent(button.dataset.component));
$('#show-preview').addEventListener('click', () => setView('preview'));
$('#show-code').addEventListener('click', () => setView('code'));
$('#copy-code').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(snippets[currentComponent]);
    $('#copy-code').textContent = 'Copied ✓';
    state('Complete setup copied to your clipboard');
    setTimeout(() => { $('#copy-code').textContent = 'Copy code ⧉'; }, 1800);
  } catch {
    state('Clipboard unavailable. Select the code and copy it manually.');
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents($('#component-code'));
    selection?.removeAllRanges(); selection?.addRange(range);
  }
});

function setTone(tone) {
  document.documentElement.dataset.tone = tone;
  for (const radio of document.querySelectorAll('input[name="theme"]')) radio.checked = radio.value === tone;
  $('.theme-label').textContent = tone.toUpperCase();
  state(`${tone === 'ink' ? 'Ink' : 'Paper'} theme selected`);
}
for (const radio of document.querySelectorAll('input[name="theme"]')) radio.addEventListener('change', () => setTone(radio.value));

const projectContent = document.createElement('div');
const projectLabel = document.createElement('label');
projectLabel.className = 'demo-label'; projectLabel.htmlFor = 'new-project-title'; projectLabel.textContent = 'Project name';
const projectInput = document.createElement('input');
projectInput.id = 'new-project-title'; projectInput.value = 'My next good idea'; projectInput.maxLength = 60; projectInput.style.width = '100%';
projectContent.append(projectLabel, projectInput);
const projectDialog = createDialog({
  title: 'Make room for a new idea.', description: 'A sample workspace. Your project name stays in this page.', content: projectContent,
  confirmLabel: 'Create project', cancelLabel: 'Not yet',
  onConfirm: () => {
    const name = projectInput.value.trim() || 'Untitled project';
    $('.mini-project b').textContent = name;
    toast.show({ title: 'A fresh start.', description: `${name} is ready in the sample workspace.`, variant: 'success' });
    state('Sample project created');
  }
});

const invitationDialog = createDialog({
  title: 'Good things come together.',
  description: 'This is a dialog preview. A real invitation flow would let you choose a teammate and review their access.',
  confirmLabel: 'Got it', cancelLabel: 'Go back',
  onConfirm: () => { state('Invitation preview confirmed'); toast.show({ title: 'A clear next step.', description: 'No invitation was sent. This is a component demo.' }); }
});

const menu = createCommandMenu({
  trigger: $('#global-search'), title: 'A shorter way there.', placeholder: 'Search components or actions…',
  commands: [
    { id: 'command-menu', label: 'Command menu', description: 'Explore search and keyboard navigation', keywords: ['find', 'actions', 'palette'], onSelect: () => selectComponent('command-menu', { scroll: true }) },
    { id: 'tabs', label: 'Tabs', description: 'Try manual keyboard activation', keywords: ['navigation', 'panels', 'view'], onSelect: () => selectComponent('tabs', { scroll: true }) },
    { id: 'dialog', label: 'Dialog', description: 'Make a little room for a decision', keywords: ['modal', 'confirm', 'overlay'], onSelect: () => selectComponent('dialog', { scroll: true }) },
    { id: 'toasts', label: 'Toast stack', description: 'Feedback, without the interruption', keywords: ['notification', 'status', 'message'], onSelect: () => selectComponent('toasts', { scroll: true }) },
    { id: 'theme', label: 'Switch the component theme', description: 'Paper or ink. Your choice.', keywords: ['dark', 'light', 'colour', 'color'], onSelect: () => setTone(document.documentElement.dataset.tone === 'ink' ? 'paper' : 'ink') },
    { id: 'project', label: 'New sample project', description: 'Try a dialog with your own text', keywords: ['create', 'workspace'], onSelect: () => projectDialog.open() },
    { id: 'future', label: 'More patterns', description: 'A little room for the next release', keywords: ['future'], disabled: true }
  ]
});
$('#hero-command').addEventListener('click', () => menu.open());
$('#playground-command').addEventListener('click', () => { state('Command menu opened'); menu.open(); });
for (const button of document.querySelectorAll('[data-hero-action]')) button.addEventListener('click', () => {
  if (button.dataset.heroAction === 'project') projectDialog.open();
  else if (button.dataset.heroAction === 'theme') { setTone(document.documentElement.dataset.tone === 'ink' ? 'paper' : 'ink'); toast.show({ title: 'A different mood.', description: 'The component preview theme has changed.' }); }
  else invitationDialog.open();
});
$('#hero-toast').addEventListener('click', () => toast.show({ title: 'That feels better.', description: 'A small signal that your action worked.', variant: 'success' }));

const tabs = createTabs($('#example-tabs'), { onChange: ({ id }) => state(`${id.replace('tab-', '')} panel selected`) });
const reviewDialog = createDialog({
  trigger: $('#playground-dialog'), title: 'Keep these changes?',
  description: 'A clear confirmation before moving on. This sample does not publish or send anything.',
  confirmLabel: 'Keep changes', cancelLabel: 'Go back',
  onConfirm: () => { state('Changes confirmed. Focus returned to the trigger.'); toast.show({ title: 'Changes confirmed.', description: 'You are back where you started.', variant: 'success' }); }
});

$('#playground-toast').addEventListener('click', () => {
  const variant = $('#toast-variant').value;
  const messages = {
    success: { title: 'Preferences saved.', description: 'Your sample workspace is up to date.', variant: 'success', action: { label: 'Undo', onClick: () => { state('Sample save undone'); toast.show({ title: 'Save undone.', description: 'The previous sample state has been restored.' }); } } },
    default: { title: 'A little update.', description: 'New components can fit into your existing project.' },
    error: { title: 'That did not go through.', description: 'A sample error with a clear next step.', variant: 'error', action: { label: 'Retry', onClick: () => { state('Sample retry succeeded'); toast.show({ title: 'Ready to continue.', description: 'The sample retry worked.', variant: 'success' }); } } }
  };
  toast.show(messages[variant]);
  state(`${variant === 'success' ? 'Success' : variant === 'error' ? 'Error' : 'Information'} notification shown`);
});

const initial = location.hash.slice(1);
selectComponent(descriptions[initial] ? initial : 'command-menu', { updateURL: false });
window.addEventListener('hashchange', () => {
  const id = location.hash.slice(1);
  if (descriptions[id] && id !== currentComponent) selectComponent(id, { updateURL: false, scroll: true });
});

// Clean up owned instances when the page is permanently left.
window.addEventListener('pagehide', (event) => {
  if (event.persisted) return;
  menu.destroy(); tabs.destroy(); projectDialog.destroy(); invitationDialog.destroy(); reviewDialog.destroy(); toast.destroy();
});
