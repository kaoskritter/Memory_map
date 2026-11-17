export const CATS = [
  { id: 'birth', name: 'Place of birth', one: 'place of birth', c: '#9C2F6E', i: '<path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6L12 16.8l-5.3 2.8 1.1-6L3.4 9.4l6-.8z"/>' },
  { id: 'home', name: 'Homes', one: 'home', c: '#2A6548', i: '<path d="M3 11l9-7 9 7M5.5 9.5V20h13V9.5M10 20v-6h4v6"/>' },
  { id: 'school', name: 'Schools and study', one: 'school', c: '#2B5C9E', i: '<path d="M2 9l10-5 10 5-10 5zM6 11.5V16c2 2 10 2 12 0v-4.5"/>' },
  { id: 'work', name: 'Work', one: 'workplace', c: '#7A4E12', i: '<path d="M3 8h18v12H3zM9 8V5h6v3M3 13h18"/>' },
  { id: 'life', name: 'Lifestyle and clubs', one: 'club or pastime', c: '#7E3A96', i: '<path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>' },
  { id: 'travel', name: 'Travel and holidays', one: 'trip', c: '#0F6E7C', i: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>' },
  { id: 'fav', name: 'Favourite places', one: 'favourite place', c: '#B5471E', i: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>' },
  { id: 'landmark', name: 'Local landmarks', one: 'landmark', c: '#4D5A6A', i: '<path d="M4 20h16M6 20V10M10 20V10M14 20V10M18 20V10M3 10l9-6 9 6z"/>' },
  { id: 'event', name: 'Life events', one: 'life event', c: '#B3261E', i: '<circle cx="9" cy="13" r="5"/><circle cx="15" cy="13" r="5"/>' },
  { id: 'end', name: 'Farewell and resting places', one: 'place', c: '#3F3A56', memorial: true, i: '<path d="M12 21V10M12 10c0-4 3-6 6-6 0 4-2 7-6 6zM12 15c-3 0-5-2-5-5 3 0 5 2 5 5z"/>' },
];
export const CAT = Object.fromEntries(CATS.map((c) => [c.id, c]));
