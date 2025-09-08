// Simplified app logic with Chart and icons
window.addEventListener('load', () => {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
  const ctx = document.getElementById('historyChart').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: { labels: Array.from({length:30},(_,i)=>i+1),
            datasets:[{label:'Habits', data:Array(30).fill(0), backgroundColor:'#4a90e2'}] },
    options: { maintainAspectRatio:false, responsive:true }
  });
});
