const profileState = {
  name: 'Aanya Sharma', username: 'aanyasharma', dob: '1998-06-14', age: 27,
  gender: 'Woman', height: "5'4\" – 5'7\"", weight: '', religion: 'Hindu', caste: '',
  manglikStatus: 'Manglik', profession: 'Product Designer', education: 'M.Des, NID',
  income: '', languages: 'Hindi, English', bio: 'Curious by nature, grounded in my values, and always ready for a thoughtful conversation over masala chai.',
  interests: 'Design, Cafés, Travel, Indie music', hobbies: 'Home cooking, Reading', personalityTraits: 'Warm, curious, thoughtful',
  smoking: 'Never', drinking: 'Socially', foodPreference: 'Vegetarian', fitness: 'Balanced', pets: 'Love pets',
  lookingFor: 'Serious relationship leading to marriage', marriageTimeline: '1–2 years', familyType: 'Open to both',
  values: 'Kindness, mutual respect, family, and open communication.', expectations: 'A steady, supportive partnership with room for both people to grow.',
  preferredAge: '27–33', preferredReligion: 'Open to discuss', preferredProfession: '', preferredEducation: 'Graduate or above', preferredHeight: '',
  manglikPreference: 'Open to discuss respectfully', distance: 'Open to relocate', preferredLanguages: 'Hindi, English', city: 'New Delhi, India',
  privacy: { hideAge: false, hideCity: false, hideProfession: false, hideLastSeen: false, hideOnlineStatus: false, privateProfile: false },
  media: { avatar: '', cover: '', gallery: [{ id: 'travel', label: 'Travel days', className: 'photo-one' }, { id: 'rituals', label: 'Little rituals', className: 'photo-two' }, { id: 'creative', label: 'Making things', className: 'photo-three' }] }
};

const profileElements = {
  editModal: document.querySelector('#edit-profile-modal'), wizardModal: document.querySelector('#profile-wizard-modal'), galleryModal: document.querySelector('#gallery-modal'),
  editorForm: document.querySelector('#profile-editor-form'), wizardForm: document.querySelector('#profile-wizard-form'),
  toast: document.querySelector('#dashboard-toast'), galleryGrid: document.querySelector('#gallery-grid'), galleryList: document.querySelector('#gallery-manager-list')
};

let profileToastTimer;
let wizardStep = 1;

const profileNotify = (message) => {
  window.clearTimeout(profileToastTimer);
  profileElements.toast.textContent = message;
  profileElements.toast.classList.add('show');
  profileToastTimer = window.setTimeout(() => profileElements.toast.classList.remove('show'), 2800);
};

const calculateAge = (dob) => {
  if (!dob) return '';
  const today = new Date();
  const birthDate = new Date(`${dob}T00:00:00`);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDifference = today.getMonth() - birthDate.getMonth();
  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) age -= 1;
  return age >= 18 && age <= 100 ? age : '';
};

const completionKeys = ['name', 'username', 'dob', 'gender', 'religion', 'manglikStatus', 'profession', 'education', 'languages', 'bio', 'interests', 'personalityTraits', 'foodPreference', 'lookingFor', 'marriageTimeline', 'preferredAge', 'manglikPreference'];
const updateCompletion = () => {
  const completed = completionKeys.filter((key) => String(profileState[key] || '').trim()).length;
  const percentage = Math.max(20, Math.round((completed / completionKeys.length) * 100));
  document.querySelector('#profile-completion-value').textContent = `${percentage}%`;
  document.querySelector('#profile-completion-progress').style.width = `${percentage}%`;
};

const setOpen = (modal, isOpen) => {
  modal.classList.toggle('open', isOpen);
  modal.setAttribute('aria-hidden', String(!isOpen));
  document.body.style.overflow = isOpen ? 'hidden' : '';
};

const hydrateFields = (selector, source = profileState) => {
  document.querySelectorAll(selector).forEach((field) => {
    const key = field.dataset.profileField || field.dataset.wizardField;
    if (key && source[key] !== undefined) field.value = source[key];
  });
};

const hydratePrivacy = (selector, privacy = profileState.privacy) => {
  document.querySelectorAll(selector).forEach((field) => {
    const key = field.dataset.profilePrivacy || field.dataset.wizardPrivacy;
    if (key) field.checked = Boolean(privacy[key]);
  });
};

const renderProfile = () => {
  document.querySelectorAll('[data-profile-display]').forEach((element) => {
    const key = element.dataset.profileDisplay;
    const value = profileState[key];
    if (key === 'username') element.textContent = value ? `@${value}` : '@username';
    else if (key === 'profession') element.textContent = `✦ ${value || 'Add profession'}`;
    else if (key === 'education') element.textContent = `◈ ${value || 'Add education'}`;
    else if (key === 'religion') element.textContent = `☼ ${value || 'Add religion'}`;
    else if (key === 'manglikStatus') element.textContent = `♧ ${value || 'Add Manglik status'}`;
    else if (key === 'city') element.textContent = `⌖ ${value || 'Add city'}`;
    else element.textContent = value || 'Add a little about yourself';
  });

  const initials = profileState.name.split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase();
  const avatar = document.querySelector('#profile-avatar');
  avatar.firstChild.nodeValue = initials;
  if (profileState.media.avatar) avatar.style.backgroundImage = `url("${profileState.media.avatar}")`;

  const cover = document.querySelector('#profile-cover');
  if (profileState.media.cover) {
    cover.style.backgroundImage = `linear-gradient(rgba(240,169,104,.25),rgba(240,169,104,.25)), url("${profileState.media.cover}")`;
    cover.style.backgroundSize = 'cover';
    cover.style.backgroundPosition = 'center';
  }

  document.querySelectorAll('[data-privacy-display="city"]').forEach((element) => element.hidden = profileState.privacy.hideCity);
  document.querySelectorAll('[data-privacy-display="profession"]').forEach((element) => element.hidden = profileState.privacy.hideProfession);
  document.querySelectorAll('[data-privacy-display="onlineStatus"]').forEach((element) => element.hidden = profileState.privacy.hideOnlineStatus);
  updateCompletion();
  renderGallery();
};

const renderGallery = () => {
  const addButton = document.querySelector('#add-gallery-photo');
  profileElements.galleryGrid.querySelectorAll('[data-gallery-photo]').forEach((item) => item.remove());
  profileState.media.gallery.forEach((photo) => {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = `photo-tile ${photo.className || ''}`;
    tile.dataset.galleryPhoto = photo.id;
    tile.dataset.profileAction = 'view-gallery-photo';
    tile.setAttribute('aria-label', `Open ${photo.label}`);
    tile.innerHTML = `<span>${photo.label}</span>`;
    if (photo.url) {
      tile.style.backgroundImage = `linear-gradient(rgba(52,35,27,.12),rgba(52,35,27,.54)), url("${photo.url}")`;
      tile.style.backgroundSize = 'cover';
      tile.style.backgroundPosition = 'center';
    }
    profileElements.galleryGrid.insertBefore(tile, addButton);
  });
};

const renderGalleryManager = () => {
  profileElements.galleryList.replaceChildren();
  profileState.media.gallery.forEach((photo, index) => {
    const row = document.createElement('article');
    row.className = 'gallery-manager-row';
    row.dataset.galleryId = photo.id;
    row.innerHTML = `<div class="gallery-manager-thumb ${photo.className || ''}"></div><div><strong>${photo.label}</strong><span>Gallery position ${index + 1}</span></div><div class="gallery-controls"><button type="button" data-gallery-move="up" aria-label="Move photo up">↑</button><button type="button" data-gallery-move="down" aria-label="Move photo down">↓</button><button type="button" data-gallery-delete aria-label="Delete photo">×</button></div>`;
    if (photo.url) row.querySelector('.gallery-manager-thumb').style.backgroundImage = `url("${photo.url}")`;
    profileElements.galleryList.append(row);
  });
};

const validateSection = (container) => {
  const fields = [...container.querySelectorAll('input, select, textarea')].filter((field) => field.type !== 'file' && field.type !== 'checkbox' && !field.readOnly);
  const invalid = fields.find((field) => !field.checkValidity());
  if (!invalid) return true;
  invalid.reportValidity();
  invalid.focus();
  return false;
};

const updateStateFromFields = (selector) => {
  document.querySelectorAll(selector).forEach((field) => {
    const key = field.dataset.profileField || field.dataset.wizardField;
    if (key) profileState[key] = field.value.trim();
  });
  profileState.age = calculateAge(profileState.dob);
};

const updatePrivacyFromFields = (selector) => {
  document.querySelectorAll(selector).forEach((field) => {
    const key = field.dataset.profilePrivacy || field.dataset.wizardPrivacy;
    if (key) profileState.privacy[key] = field.checked;
  });
};

const openEditor = () => {
  hydrateFields('[data-profile-field]');
  hydratePrivacy('[data-profile-privacy]');
  document.querySelector('#profile-age-input').value = calculateAge(profileState.dob);
  document.querySelector('[data-character-count]').textContent = profileState.bio.length;
  setOpen(profileElements.editModal, true);
};

const updateWizard = () => {
  document.querySelectorAll('[data-wizard-step]').forEach((step) => step.classList.toggle('active', Number(step.dataset.wizardStep) === wizardStep));
  document.querySelectorAll('[data-wizard-dot]').forEach((dot) => dot.classList.toggle('active', Number(dot.dataset.wizardDot) <= wizardStep));
  document.querySelector('#wizard-back').hidden = wizardStep === 1;
  document.querySelector('#wizard-next').classList.toggle('hidden', wizardStep === 4);
  document.querySelector('#wizard-finish').classList.toggle('hidden', wizardStep !== 4);
  document.querySelector('#wizard-step-label').textContent = `Step ${wizardStep} of 4`;
};

const openWizard = () => {
  hydrateFields('[data-wizard-field]');
  hydratePrivacy('[data-wizard-privacy]');
  wizardStep = 1;
  updateWizard();
  setOpen(profileElements.wizardModal, true);
};

const readImage = (file, callback) => {
  if (!file?.type.startsWith('image/')) {
    profileNotify('Please select an image file.');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => callback(reader.result);
  reader.readAsDataURL(file);
};

document.querySelector('#edit-profile-button').addEventListener('click', openEditor);
document.querySelector('#start-profile-wizard').addEventListener('click', openWizard);
document.querySelector('#improve-profile-button').addEventListener('click', openWizard);
document.querySelector('#manage-photos-button').addEventListener('click', () => { renderGalleryManager(); setOpen(profileElements.galleryModal, true); });
document.querySelector('#add-gallery-photo').addEventListener('click', () => document.querySelector('#gallery-picture-upload').click());
document.querySelector('#gallery-upload-button').addEventListener('click', () => document.querySelector('#gallery-picture-upload').click());

document.querySelectorAll('[data-close-profile-modal]').forEach((button) => button.addEventListener('click', () => setOpen(profileElements.editModal, false)));
document.querySelectorAll('[data-close-wizard]').forEach((button) => button.addEventListener('click', () => setOpen(profileElements.wizardModal, false)));
document.querySelectorAll('[data-close-gallery]').forEach((button) => button.addEventListener('click', () => setOpen(profileElements.galleryModal, false)));

document.querySelectorAll('.editor-tab').forEach((tab) => tab.addEventListener('click', () => {
  document.querySelectorAll('.editor-tab').forEach((item) => item.classList.toggle('active', item === tab));
  document.querySelectorAll('[data-editor-panel]').forEach((panel) => panel.classList.toggle('active', panel.dataset.editorPanel === tab.dataset.editorTab));
}));

document.querySelector('#profile-dob-input').addEventListener('change', (event) => {
  document.querySelector('#profile-age-input').value = calculateAge(event.target.value);
});

document.querySelector('[data-profile-field="bio"]').addEventListener('input', (event) => {
  document.querySelector('[data-character-count]').textContent = event.target.value.length;
});

profileElements.editorForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const activePanel = profileElements.editorForm.querySelector('.editor-panel.active');
  if (!validateSection(activePanel)) return;
  updateStateFromFields('[data-profile-field]');
  updatePrivacyFromFields('[data-profile-privacy]');
  renderProfile();
  setOpen(profileElements.editModal, false);
  profileNotify('Profile saved locally and prepared for future Supabase upsert.');
});

document.querySelector('#wizard-next').addEventListener('click', () => {
  const step = document.querySelector(`[data-wizard-step="${wizardStep}"]`);
  if (!validateSection(step)) return;
  updateStateFromFields('[data-wizard-field]');
  wizardStep += 1;
  updateWizard();
});

document.querySelector('#wizard-back').addEventListener('click', () => {
  wizardStep = Math.max(1, wizardStep - 1);
  updateWizard();
});

profileElements.wizardForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!validateSection(document.querySelector('[data-wizard-step="4"]'))) return;
  updateStateFromFields('[data-wizard-field]');
  updatePrivacyFromFields('[data-wizard-privacy]');
  renderProfile();
  setOpen(profileElements.wizardModal, false);
  profileNotify('Your profile is ready to grow with you.');
});

document.querySelector('#profile-picture-upload').addEventListener('change', (event) => readImage(event.target.files[0], (image) => { profileState.media.avatar = image; renderProfile(); }));
document.querySelector('#cover-picture-upload').addEventListener('change', (event) => readImage(event.target.files[0], (image) => { profileState.media.cover = image; renderProfile(); }));
document.querySelector('#gallery-picture-upload').addEventListener('change', (event) => {
  [...event.target.files].slice(0, 6 - profileState.media.gallery.length).forEach((file, index) => readImage(file, (image) => {
    profileState.media.gallery.push({ id: `upload-${Date.now()}-${index}`, label: 'New moment', url: image, className: '' });
    renderProfile();
  }));
  event.target.value = '';
});

document.querySelectorAll('[data-profile-action="crop-avatar"], [data-profile-action="crop-cover"]').forEach((button) => button.addEventListener('click', () => profileNotify('Crop controls are ready for future image editor integration.')));

profileElements.galleryList.addEventListener('click', (event) => {
  const row = event.target.closest('[data-gallery-id]');
  if (!row) return;
  const index = profileState.media.gallery.findIndex((photo) => photo.id === row.dataset.galleryId);
  if (event.target.matches('[data-gallery-delete]')) profileState.media.gallery.splice(index, 1);
  if (event.target.dataset.galleryMove === 'up' && index > 0) [profileState.media.gallery[index - 1], profileState.media.gallery[index]] = [profileState.media.gallery[index], profileState.media.gallery[index - 1]];
  if (event.target.dataset.galleryMove === 'down' && index < profileState.media.gallery.length - 1) [profileState.media.gallery[index + 1], profileState.media.gallery[index]] = [profileState.media.gallery[index], profileState.media.gallery[index + 1]];
  renderGallery();
  renderGalleryManager();
});

document.querySelector('#share-profile-button').addEventListener('click', async () => {
  const profileUrl = `${window.location.origin}${window.location.pathname}#profile`;
  if (navigator.share) {
    try { await navigator.share({ title: `${profileState.name} · Manglik Meets`, text: 'View my Manglik Meets profile.', url: profileUrl }); return; } catch {}
  }
  try { await navigator.clipboard.writeText(profileUrl); profileNotify('Profile link copied to clipboard.'); } catch { profileNotify('Your profile link is ready to share.'); }
});

window.profileCrudAdapter = {
  getProfilePayload: () => ({ ...profileState, privacy: { ...profileState.privacy } }),
  getMediaPayload: () => profileState.media.gallery.map((photo, index) => ({ ...photo, sort_order: index }))
};

renderProfile();
