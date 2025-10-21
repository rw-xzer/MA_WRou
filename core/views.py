from django.shortcuts import render, redirect
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.forms import AuthenticationForm
from django.utils import timezone
from django.db.models import Max, Count, Q
from datetime import datetime, timedelta
import json
import random

from .models import (
    UserProfile,
    Habit,
    Task,
    StudySession,
    Tag,
    HabitLog,
    TaskLog,
    StatSlot,
    ShopItem,
    UserPurchase,
)

def login_view(request):
  """Login view"""
  if request.user.is_authenticated:
    return redirect('index')
  
  if request.method == 'POST':
    form = AuthenticationForm(request, data=request.POST)
    if form.is_valid():
      username = form.cleaned_data.get('username')
      password = form.cleaned_data.get('password')
      user = authenticate(username=username, password=password)
      if user is not None:
        login(request, user)
        return redirect('index')
  else:
    form = AuthenticationForm()
  
  return render(request, 'login.html', {'form': form})

def logout_view(request):
  """Logout view"""
  logout(request)
  return redirect('login')

@login_required
def index(request):
  """Main dashboard view"""
  return render (request, 'index.html')

@login_required
def stats_page(request):
  """Monthly stat page"""
  return render(request, 'stats.html')

@login_required
def shop_page(request):
  """Shop page"""
  return render(request, 'shop.html')

# API Endpoints
@login_required
@require_http_methods(["GET"])
def api_user_profile(request):
  """Get user profile data"""
  profile, _ = UserProfile.objects.get_or_create(user=request.user)
  return JsonResponse({
    'level': profile.level,
    'xp': profile.xp,
    'max_xp': profile.max_xp,
    'hp': profile.hp,
    'max_hp': profile.max_hp,
    'coins': profile.coins,
    'avatar': profile.avatar,
    'avatar_state': profile.avatar_state,
    })

@login_required
@require_http_methods(["GET"])
def api_habits(request):
  """Get user habits"""
  filter_type = request.GET.get('filter', 'all')
  # 
  search_query = request.GET.get('search', '').strip()
  tag_filter = request.GET.get('tag', '').strip()
  
  habits = Habit.objects.filter(user=request.user)

  # Apply search filter
  if search_query:
    habits = habits.filter(Q(title__icontains=search_query) | Q(details__icontains=search_query))

  # Apply tag filter
  if tag_filter:
    habits = habits.filter(tags__name=tag_filter).distinct()

  if filter_type == 'weak':
    habits = [h for h in habits if not h.strong()]
  elif filter_type == 'strong':
    habits = [h for h in habits if h.strong()]

  habits_data = []
  for habit in habits:
    habits_data.append({
      'id': habit.id,
      'title': habit.title,
      'details': habit.details,
      'tags': [tag.name for tag in habit.tags.all()],
      'diff': habit.diff,
      'allow_pos': habit.allow_pos,
      'allow_neg': habit.allow_neg,
      'pos_count': habit.pos_count,
      'neg_count': habit.neg_count,
      'color': habit.get_color(),
      'strong': habit.strong(),
    })

  return JsonResponse({'habits': habits_data})

@login_required
@require_http_methods(["GET"])
def api_tasks(request):
  """Get user tasks"""
  filter_type = request.GET.get('filter', 'all')
  search_query = request.GET.get('search', '').strip()
  tag_filter = request.GET.get('tag', '').strip()

  tasks = Task.objects.filter(user=request.user)

  # Apply search filter
  if search_query:
    tasks = tasks.filter(Q(title__icontains=search_query) | Q(details__icontains=search_query))

  # Apply tag filter
  if tag_filter:
    tasks = tasks.filter(tags__name=tag_filter).distinct()

  if filter_type == 'scheduled':
    tasks = tasks.filter(task_type='scheduled')
  elif filter_type == 'dailies':
    tasks = tasks.filter(task_type='daily')

  tasks_data = []
  for task in tasks:
    tasks_data.append({
    'id': task.id,
    'title': task.title,
    'details': task.details,
    'tags': [tag.name for tag in task.tags.all()],
    'diff': task.diff,
    'task_type': task.task_type,
    'due': task.due,
    'completed': task.completed,
    'streak': task.streak,
    'color': task.get_color(),
    'overdue': task.overdue(), 
    })

  return JsonResponse({'tasks': tasks_data})

@login_required
@csrf_exempt
@require_http_methods(["POST"])
def api_create_habit(request):
  """Create a new habit"""
  data = json.loads(request.body)

  habit = Habit.objects.create(
    user=request.user,
    title=data.get('title'),
    details=data.get('details', ''),
    diff=data.get('diff', 'trivial'),
    allow_pos=data.get('allow_pos', True),
    allow_neg=data.get('allow_neg', True),
    reset_freq=data.get('reset_freq', 'never'),
  )

  tag_names = data.get('tags', [])
  for tag_name in tag_names:
    tag, _ = Tag.objects.get_or_create(name=tag_name)
    habit.tags.add(tag)

  return JsonResponse({'id': habit.id, 'success': True})

@login_required
@csrf_exempt
@require_http_methods(["PUT"])
def api_update_habit(request, habit_id):
  """Update an existing habit"""
  try:
    habit = Habit.objects.get(id=habit_id, user=request.user)
    data = json.loads(request.body)

    habit.title = data.get('title', habit.title)
    habit.details = data.get('details', habit.details)
    habit.diff = data.get('diff', habit.diff)
    habit.allow_pos = data.get('allow_pos', habit.allow_pos)
    habit.allow_neg = data.get('allow_neg', habit.allow_neg)
    habit.reset_freq = data.get('reset_freq', habit.reset_freq)
    habit.save()

    # Update tags
    tag_names = data.get('tags', [])
    habit.tags.clear()
    for tag_name in tag_names:
      tag, _ = Tag.objects.get_or_create(name=tag_name)
      habit.tags.add(tag)

    return JsonResponse({'id': habit.id, 'success': True})
  except Habit.DoesNotExist:
    return JsonResponse({'error': 'Habit not found'}, status=404)

@login_required
@csrf_exempt
@require_http_methods(["DELETE"])
def api_delete_habit(request, habit_id):
  """Delete an existing habit"""
  try:
    habit = Habit.objects.get(id=habit_id, user=request.user)
    habit.delete()
    return JsonResponse({'success': True})
  except Habit.DoesNotExist:
    return JsonResponse({'error': 'Habit not found'}, status=404)

@login_required
@csrf_exempt
@require_http_methods(["POST"])
def api_create_task(request):
  """Create a new task"""
  data = json.loads(request.body)

  due = None
  if data.get('due_date'):
    dt_str = data.get('due_date').replace('Z', '+00:00')
    due = datetime.fromisoformat(dt_str)
    if timezone.is_naive(due):
      due = timezone.make_aware(due)

  task = Task.objects.create(
    user=request.user,
    title=data.get('title'),
    details=data.get('details', ''),
    diff=data.get('diff', 'trivial'),
    task_type=data.get('task_type', 'scheduled'),
    due=due,
  )

  tag_names = data.get('tags', [])
  for tag_name in tag_names:
    tag, _ = Tag.objects.get_or_create(name=tag_name)
    task.tags.add(tag)

  return JsonResponse({'id': task.id, 'success': True})

@login_required
@csrf_exempt
@require_http_methods(["PUT"])
def api_update_task(request, task_id):
  """Update an existing task"""
  try:
    task = Task.objects.get(id=task_id, user=request.user)
    data = json.loads(request.body)

    task.title = data.get('title', task.title)
    task.details = data.get('details', task.details)
    task.diff = data.get('diff', task.diff)
    task.task_type = data.get('task_type', task.task_type)

    # Update due date if provided
    if 'due_date' in data and data.get('due_date'):
      dt_str = data.get('due_date').replace('Z', '+00:00')
      due = datetime.fromisoformat(dt_str)
      if timezone.is_naive(due):
        due = timezone.make_aware(due)
      task.due = due
    elif task.task_type == 'daily':
      task.due = None

    task.save()

    # Update tags
    tag_names = data.get('tags', [])
    task.tags.clear()
    for tag_name in tag_names:
      tag, _ = Tag.objects.get_or_create(name=tag_name)
      task.tags.add(tag)

    return JsonResponse({'id': task.id, 'success': True})
  except Task.DoesNotExist:
    return JsonResponse({'error': 'Task not found'}, status=404)

@login_required
@csrf_exempt
@require_http_methods(["DELETE"])
def api_delete_task(request, task_id):
  """Delete an existing task"""
  try:
    task = Task.objects.get(id=task_id, user=request.user)
    task.delete()
    return JsonResponse({'success': True})
  except Task.DoesNotExist:
    return JsonResponse({'error': 'Task not found'}, status=404)

@login_required
@csrf_exempt
@require_http_methods(["POST"])
def api_start_study_session(request):
  """Start a study session"""
  data = json.loads(request.body)

  StudySession.objects.filter(user=request.user, active=True).update(active=False)

  session = StudySession.objects.create(
    user=request.user,
    subject=data.get('subject', 'General'),
  )

  profile, _ = UserProfile.objects.get_or_create(user=request.user)
  profile.avatar_state = 'studying'
  profile.save()

  return JsonResponse({'id': session.id, 'success': True})

@login_required
@csrf_exempt
@require_http_methods(["POST"])
def api_stop_study_session(request):
  """Stop active study session"""
  session = StudySession.objects.filter(user=request.user, active=True).first()

  if session:
    duration = session.stop()

    profile, _ = UserProfile.objects.get_or_create(user=request.user)
    profile.avatar_state = 'idle'
    if duration:
      hours = duration / 60.0
      profile.all_time_hours_studied += hours
    profile.save()

    return JsonResponse({'duration_minutes': duration, 'success': True})
  
  return JsonResponse({'error': 'No active study session found'}, status=400)

@login_required
@csrf_exempt
@require_http_methods(["POST"])
def api_complete_habit(request, habit_id):
  """Complete a habit (positive/negative)"""
  data = json.loads(request.body)
  is_positive = data.get('positive', True)

  try:
    habit = Habit.objects.get(id=habit_id, user=request.user)

    if is_positive and habit.allow_pos:
      habit.incr_pos()
      HabitLog.objects.create(habit=habit, positive=True)

      profile, _ = UserProfile.objects.get_or_create(user=request.user)
      
      # Base XP : 3-5
      base_min = 3
      base_max = 5

      # Add diff bonus : +2xp per diff
      diff_bonus = {'trivial': 0, 'easy': 2, 'medium': 4, 'hard': 6}[habit.diff]
      xp = random.randint(base_min + diff_bonus, base_max + diff_bonus)

      profile.add_xp(xp)
      
      # Coins : medium = 1-3, hard = 3-5
      coins = 0
      if habit.diff == 'medium':
        coins = random.randint(1,3)
      elif habit.diff == 'hard':
        coins = random.randint(3,5)
      
      if coins > 0:
        profile.add_coins(coins)
      profile.all_time_habits_completed += 1
      profile.save()

    elif not is_positive and habit.allow_neg:
      habit.incr_neg()
      HabitLog.objects.create(habit=habit, positive=False)

      profile, _ = UserProfile.objects.get_or_create(user=request.user)
      
      # Negative habits : same value as XP gain
      base_min = 3
      base_max = 5
      diff_penalty = {'trivial': 0, 'easy': 2, 'medium': 4, 'hard': 6}[habit.diff]
      hp_loss = random.randint(base_min + diff_penalty, base_max + diff_penalty)
      profile.lose_health(hp_loss)

      profile.save()

    return JsonResponse({'success': True})
  except Habit.DoesNotExist:
    return JsonResponse({'error': 'Habit not found'}, status=404)
  
@login_required
@csrf_exempt
@require_http_methods(["POST"])
def api_complete_task(request, task_id):
  """Complete a task"""
  try:
    task = Task.objects.get(id=task_id, user=request.user)

    if not task.completed:
      task.complete()
      TaskLog.objects.create(task=task)

      profile, _ = UserProfile.objects.get_or_create(user=request.user)
      
      # Base XP : 5-10
      base_min = 5
      base_max = 10

      # Add diff bonus : +2xp per diff
      diff_bonus = {'trivial': 0, 'easy': 2, 'medium': 4, 'hard': 6}[task.diff]
      xp = random.randint(base_min + diff_bonus, base_max + diff_bonus)
      profile.add_xp(xp)
      
      # Coins : medium = 1-3, hard = 3-5
      coins = 0
      if task.diff == 'medium':
        coins = random.randint(1,3)
      elif task.diff == 'hard':
        coins = random.randint(3,5)

      if coins > 0:
        profile.add_coins(coins)
      profile.all_time_tasks_completed += 1

      # Update longest daily streak
      if task.task_type == 'daily' and task.streak > profile.longest_daily_streak:
        profile.longest_daily_streak = task.streak
      profile.save()

      level_up = profile.xp >= profile.max_xp
      if level_up:
        profile.avatar_state = 'celebrating'
        profile.save()
      
      return JsonResponse({
        'success': True,
        'level_up': level_up,
        'xp_earned': xp,
        'coins_earned': coins,
      })
    
    return JsonResponse({'error': 'Task already completed'}, status=400)
  except Task.DoesNotExist:
    return JsonResponse({'error': 'Task not found'}, status=404)
  
@login_required
@require_http_methods(["GET"])
def api_check_dailies(request):
  """Check and update daily task completion"""
  today = timezone.now().date()
  dailies = Task.objects.filter(user=request.user, task_type='daily', completed=False)

  profile, _ = UserProfile.objects.get_or_create(user=request.user)
  missed_dailies = 0

  for daily in dailies:
    if daily.last_completed is None or daily.last_completed.date() < today:
      # Missed dailies : -2 hp base, + diff : -1hp
      hp_loss = 2
      diff_penalty = {'trivial': 0, 'easy': 1, 'medium': 2, 'hard': 3}[daily.diff]
      hp_loss += diff_penalty
      profile.lose_health(hp_loss)
      missed_dailies += 1

  overdue = Task.objects.filter(
    user=request.user,
    task_type='scheduled',
    completed=False,
    due__lt=timezone.now()
  )

  for task in overdue:
    # Missed duedates : -2hp base, + diff : -1hp
    hp_loss = 2
    diff_penalty = {'trivial': 0, 'easy': 1, 'medium': 2, 'hard': 3}[task.diff]
    hp_loss += diff_penalty
    
    # per additional missed week : * 2 penalty
    days_overdue = (timezone.now() - task.due).days
    weeks_overdue = days_overdue // 7
    if weeks_overdue > 0:
      hp_loss = hp_loss * (2 ** weeks_overdue)
    
    profile.lose_health(hp_loss)

  profile.save()

  return JsonResponse({
    'missed_dailes': missed_dailies,
    'overdue_tasks': overdue.count(),
  })

@login_required
@require_http_methods(["GET"])
def api_last_week_recap(request):
  """Generate last week recap with standout stats algorithm"""
  prev_week = timezone.now() - timedelta(days=7)
  prev_week_start = prev_week.replace(hour=0, minute=0, second=0, microsecond=0)

  habits_completed = HabitLog.objects.filter(
    habit__user=request.user,
    created_at__gte=prev_week_start
  ).count()

  tasks_completed = TaskLog.objects.filter(
    task__user=request.user,
    created_at__gte=prev_week_start
  ).count()

  study_sessions = StudySession.objects.filter(
    user=request.user,
    start_time__gte=prev_week_start,
    active=False
  )
  total_study_hours = sum(s.duration_minutes or 0 for s in study_sessions) / 60

  missed_dailies = Task.objects.filter(
    user=request.user,
    task_type='daily',
  ).exclude(
    last_completed__gte=prev_week_start
  ).count()

  # Find standout stats
  standout_items = []

  # Highest streak in dailies
  highest_streak_task = Task.objects.filter(
    user=request.user,
    task_type='daily',
    streak__gt=0
  ).order_by('-streak').first()
  if highest_streak_task and highest_streak_task.streak >= 5:
    standout_items.append({
      'type': 'streak',
      'title': f"{highest_streak_task.title}",
      'description': f"{highest_streak_task.streak} day streak!",
      'icon': 'flame',
      'score': highest_streak_task.streak * 10
    })

  # Most completed habit
  habit_logs = HabitLog.objects.filter(
    habit__user=request.user,
    created_at__gte=prev_week_start,
    positive=True
  ).values('habit__id', 'habit__title').annotate(count=Count('id')).order_by('-count')

  if habit_logs and habit_logs[0]['count'] >= 5:
    top_habit = habit_logs[0]
    standout_items.append({
      'type': 'habit',
      'title':f"{top_habit['habit__title']}",
      'description': f"Completed {top_habit['count']} times",
      'icon': 'thumbs-up',
      'score': top_habit['count'] * 5
    })

  # Longest study session
  longest_session = study_sessions.order_by('-duration_minutes').first()
  if longest_session and longest_session.duration_minutes and longest_session.duration_minutes >= 60:
    hours = longest_session.duration_minutes / 60
    standout_items.append({
      'type': 'study',
      'title': longest_session.subject,
      'description': f"{hours:.1f} hour session",
      'icon': 'clock',
      'score': longest_session.duration_minutes
    })

  # Best habit (highest positive to negative ratio)
  habits = Habit.objects.filter(user=request.user)
  for habit in habits:
    total = habit.pos_count + habit.neg_count
    if total >= 5: # Minimum activity
      ratio = habit.pos_count /total if total > 0 else 0
      if ratio >= 0.8:
        standout_items.append({
          'type': 'habit_ratio',
          'title': habit.title,
          'description': f"{int(ratio * 100)}% positive",
          'icon': 'star',
          'score': int(ratio * 100)
        })
        break

  # Sort score and take top 3-5
  standout_items.sort(key=lambda x: x['score'], reverse=True)
  standout_items = standout_items[:5]

  if standout_items:
    recap_text = "Last week highlights:"
  else:
    recap_text = "No standout stats last week. Let's aim higher this week!"

  return JsonResponse({
    'recap': recap_text,
    'hours_studied': round(total_study_hours, 1),
    'tasks_completed': tasks_completed,
    'missed_dailies': missed_dailies,
    'items': standout_items,
  })

@login_required
@require_http_methods(["GET", "POST"])
def api_stat_slots(request):
  """Get or update user stat slots"""
  if request.method == "GET":
    slots = StatSlot.objects.filter(user=request.user)
    slots_data = {}
    for slot in slots:
      slots_data[slot.slot_number] = slot.stat_type

    return JsonResponse({'slots': slots_data})
  
  else:
    data = json.loads(request.body)
    slot_number = data.get('slot_number')
    stat_type = data.get('stat_type')

    slot, _ = StatSlot.objects.get_or_create(
      user=request.user,
      slot_number = slot_number
    )
    slot.stat_type = stat_type
    slot.save()

    return JsonResponse({'success': True})

@login_required
@require_http_methods(["GET"])
def api_stat_value(request):
  """Get value for specific stat type"""
  stat_type = request.GET.get('type')
  profile, _ = UserProfile.objects.get_or_create(user=request.user)

  if stat_type == 'hours_studied':
    return JsonResponse({'value': round(profile.all_time_hours_studied, 1)})
  
  elif stat_type == 'tasks_completed':
    return JsonResponse({'value': profile.all_time_tasks_completed})
  
  elif stat_type == 'habits_completed':
    return JsonResponse({'value': profile.all_time_habits_completed})
  
  elif stat_type == 'current_streak':
    max_streak = Task.objects.filter(user=request.user, task_type='daily').aggregate(
      max_streak=Max('streak')
    )['max_streak'] or 0
    return JsonResponse({'value': max_streak})
  
  elif stat_type == 'longest_streak':
    return JsonResponse({'value': profile.longest_daily_streak})
  
  elif stat_type == 'coins_earned':
    return JsonResponse({'value': profile.all_time_coins_earned})
  
  elif stat_type == 'level':
    return JsonResponse({'value': profile.highest_level_ever})
  
  return JsonResponse({'value': 0})

@login_required
@require_http_methods(["GET"])
def api_tags(request):
  """Get all available tags and ensure default tags by user exist"""
  default_tags = ["Work", "Health", "Creativity", "Study", "Exercise", "Hobby", "Chores"]

  for tag_name in default_tags:
    Tag.objects.get_or_create(name=tag_name)

  user_habit_tags = Tag.objects.filter(habit__user=request.user).distinct()
  user_task_tags = Tag.objects.filter(task__user=request.user).distinct()
  user_tags = (user_habit_tags | user_task_tags).distinct()

  default_tag_names = set(default_tags)

  user_tag_names = set([tag.name for tag in user_tags])

  all_tag_names = list(default_tag_names | user_tag_names)
  all_tag_names.sort()

  return JsonResponse({'tags': all_tag_names})

@login_required
@require_http_methods(["GET"])
def api_shop_items(request):
  """Get shop items"""
  items = ShopItem.objects.filter(active=True)
  items_data = []
  for item in items:
    items_data.append({
      'id': item.id,
      'name': item.name,
      'description': item.description,
      'item_type': item.item_type,
      'price': item.price,
      'image_url': item.image_url,
    })

  return JsonResponse({'items': items_data})

@login_required
@csrf_exempt
@require_http_methods(["POST"])
def api_purchase_item(request):
  """Purchase item from shop"""
  data = json.loads(request.body)
  item_id = data.get('item_id')

  try:
    item = ShopItem.objects.get(id=item_id, active=True)
    profile, _ = UserProfile.objects.get_or_create(user=request.user)

    if profile.coins >= item.price:
      profile.coins -= item.price
      profile.save()

      UserPurchase.objects.get_or_create(user=request.user, item=item)

      return JsonResponse({'success': True, 'coins_left': profile.coins})
    else:
      return JsonResponse({'error': 'Insufficient coins'}, status=400)
    
  except ShopItem.DoesNotExist:
    return JsonResponse({'error': 'Item not found'}, status=404)
  
@login_required
@require_http_methods(["GET"])
def api_monthly_stats(request):
  """Get monthly study stats (subject, day)"""
  now = timezone.now()
  start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
  
  sessions = StudySession.objects.filter(
    user=request.user,
    start_time__gte=start_of_month,
    active=False
  )

  stats_by_subject = {}
  stats_by_day = {}

  for session in sessions:
    subject = session.subject
    day = session.start_time.date()
    duration = (session.duration_minutes or 0) / 60

    if subject not in stats_by_subject:
      stats_by_subject[subject] = 0
    stats_by_subject[subject] += duration

    day_str = day.isoformat()
    if day_str not in stats_by_day:
      stats_by_day[day_str] = 0
    stats_by_day[day_str] += duration

  return JsonResponse({
    'by_subject': stats_by_subject,
    'by_day': stats_by_day,
  })