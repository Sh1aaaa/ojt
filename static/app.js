const $ = (id) => document.getElementById(id);
const loginPanel = $('login-panel'), dashboard = $('dashboard');
let toastTimer;
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3200)}
function localDateTime(value, dateOnly=false){
  if(!value) return '—';
  const d=new Date(value);
  return new Intl.DateTimeFormat('en-PH',dateOnly?{timeZone:'Asia/Manila',day:'2-digit',month:'short',year:'numeric'}:{timeZone:'Asia/Manila',hour:'2-digit',minute:'2-digit',hour12:true}).format(d);
}
function tick(){
 const now=new Date();
 $('live-time').textContent=new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true}).format(now);
 $('live-date').textContent=new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',weekday:'short',day:'2-digit',month:'short',year:'numeric'}).format(now);
}
async function api(path, options={}){
 const r=await fetch(path,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
 const data=await r.json().catch(()=>({}));
 if(!r.ok) throw new Error(data.error||'Something went wrong.');
 return data;
}
function showDashboard(employee){
 loginPanel.classList.add('hidden');dashboard.classList.remove('hidden');$('logout').classList.remove('hidden');
 $('employee-name').textContent=employee.name||employee.email||'Employee';loadAttendance();
}
async function loadAttendance(){
 try{
  const data=await api('/api/attendance');
  const records=data.records||[];
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const current=records.find(x=>x.work_date===today);
  if(current){
   if(current.time_out){$('status-title').textContent='Workday completed';$('status-desc').textContent=`Timed in at ${localDateTime(current.time_in)} and timed out at ${localDateTime(current.time_out)}.`;$('status-pill').textContent='COMPLETED';$('status-pill').className='pill done';}
   else{$('status-title').textContent='Currently working';$('status-desc').textContent=`You timed in at ${localDateTime(current.time_in)}.`;$('status-pill').textContent='CLOCKED IN';$('status-pill').className='pill active';}
  }else{$('status-title').textContent='Not clocked in';$('status-desc').textContent='Record your time in when you start work.';$('status-pill').textContent='NOT STARTED';$('status-pill').className='pill neutral';}
  $('clock-in').disabled=!!current;$('clock-out').disabled=!current||!!current.time_out;
  $('clock-in').style.opacity=$('clock-in').disabled?'.45':'1';$('clock-out').style.opacity=$('clock-out').disabled?'.45':'1';
  $('history').innerHTML=records.length?records.map(r=>`<tr><td>${localDateTime(r.work_date+'T00:00:00',true)}</td><td>${localDateTime(r.time_in)}</td><td>${localDateTime(r.time_out)}</td><td><span class="record-status">${r.time_out?'COMPLETED':r.time_in?'IN PROGRESS':'—'}</span></td></tr>`).join(''):'<tr><td colspan="4" class="empty">No attendance records yet.</td></tr>';
 }catch(e){toast(e.message)}
}
$('login-form').addEventListener('submit',async e=>{
 e.preventDefault();$('login-error').textContent='';
 const button=e.submitter;button.disabled=true;button.textContent='SIGNING IN...';
 try{const data=await api('/api/login',{method:'POST',body:JSON.stringify({email:$('email').value,password:$('password').value})});showDashboard(data.employee);toast('Signed in successfully.')}
 catch(err){$('login-error').textContent=err.message}
 finally{button.disabled=false;button.innerHTML='Sign in <span>→</span>'}
});
$('clock-in').addEventListener('click',()=>record('/api/clock-in'));
$('clock-out').addEventListener('click',()=>record('/api/clock-out'));
async function record(path){
 const button=path.includes('in')?$('clock-in'):$('clock-out');button.disabled=true;
 try{const data=await api(path,{method:'POST',body:'{}'});toast(data.message||'Attendance saved.');await loadAttendance()}
 catch(e){toast(e.message);await loadAttendance()}
}
$('refresh').addEventListener('click',loadAttendance);
$('logout').addEventListener('click',async()=>{await api('/api/logout',{method:'POST',body:'{}'});location.reload()});
(async()=>{tick();setInterval(tick,1000);try{const data=await api('/api/me');showDashboard(data.employee)}catch(_){}})();
