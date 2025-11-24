from django.shortcuts import render, redirect
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.forms import AuthenticationForm
from django.utils import timezone
from django.db.models import Max, Count, Q, Sum
from django.db.models.functions import TruncDate
from datetime import datetime, timedelta
import json
import random
import logging

from .models import (
    UserProfile,
    Habit,
    Task,
    StudySession,
    SubjectColor,
    Tag,
    HabitLog,
    TaskLog,
    LevelLog,
    StatSlot,
    ShopItem,
    UserPurchase,
)

# Background colors
BACKGROUND_COLORS = {
  'bg_blue_background': {
    'name': 'Blue Background',
    'display_name': 'Blue',
    'color': '#93c5fd',
    'floor_color': '#3b82f6'
  },
  'bg_green_background': {
    'name': 'Green Background',
    'display_name': 'Green',
    'color': '#86efac',
    'floor_color': '#22c55e'
  },
  'bg_yellow_background': {
    'name': 'Yellow Background',
    'display_name': 'Yellow',
    'color': '#fde047',
    'floor_color': '#eab308'
  },
  'bg_purple_background': {
    'name': 'Purple Background',
    'display_name': 'Purple',
    'color': '#c4b5fd',
    'floor_color': '#8b5cf6'
  },
  'bg_gray_background': {
    'name': 'Gray Background',
    'display_name': 'Gray',
    'color': '#d1d5db',
    'floor_color': '#6b7280'
  },
}

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
  """Monthly stat page - inaccessible during active study session"""
  # Check if user has an active study session
  active_session = StudySession.objects.filter(user=request.user, active=True).first()
  if active_session:
    # Redirect to home page
    return redirect('index')
  
  return render(request, 'stats.html')

@login_required
def shop_page(request):
  """Shop page - inaccessible during active study session"""
  # Check if user has an active study session
  active_session = StudySession.objects.filter(user=request.user, active=True).first()
  if active_session:
    return redirect('index')
  
  return render(request, 'shop.html')

# API Endpoints
@login_required
@require_http_methods(["GET", "POST"])
def api_user_profile(request):
  """Get user profile data"""
  profile, _ = UserProfile.objects.get_or_create(user=request.user)
  
  if request.method == 'POST':
    data = json.loads(request.body) if request.body else {}
    if 'avatar_state' in data:
      profile.avatar_state = data['avatar_state']
    if 'avatar_background_color' in data:
      profile.avatar_background_color = data['avatar_background_color']
      if profile.coins >= 50:
        profile.coins -= 50
    if 'avatar_floor_color' in data:
      profile.avatar_floor_color = data['avatar_floor_color']
    if 'avatar_character' in data:
      profile.avatar_character = data['avatar_character']
    if 'avatar_clothes' in data:
      profile.avatar_clothes = data['avatar_clothes']
    if 'avatar_shirt' in data:
      profile.avatar_shirt = data['avatar_shirt']
    if 'avatar_pants' in data:
      profile.avatar_pants = data['avatar_pants']
    if 'avatar_socks' in data:
      profile.avatar_socks = data['avatar_socks']
    if 'avatar_shoes' in data:
      profile.avatar_shoes = data['avatar_shoes']
    profile.save()
  
  return JsonResponse({
    'level': profile.level,
    'xp': profile.xp,
    'max_xp': profile.max_xp,
    'hp': profile.hp,
    'max_hp': profile.max_hp,
    'coins': profile.coins,
    'avatar': profile.avatar,
    'avatar_state': profile.avatar_state,
    'avatar_background_color': getattr(profile, 'avatar_background_color', None) or '#d8b9b9',
    'avatar_floor_color': getattr(profile, 'avatar_floor_color', None) or '#d8aeae',
    'avatar_character': getattr(profile, 'avatar_character', None) or 'default_girl',
    'avatar_clothes': getattr(profile, 'avatar_clothes', None) or 'default',
    'avatar_shirt': getattr(profile, 'avatar_shirt', None) or 'default',
    'avatar_pants': getattr(profile, 'avatar_pants', None) or 'default',
    'avatar_socks': getattr(profile, 'avatar_socks', None) or 'default',
    'avatar_shoes': getattr(profile, 'avatar_shoes', None) or 'default',
    })

@login_required
@require_http_methods(["GET"])
def api_habits(request):
  """Get user habits"""
  filter_type = request.GET.get('filter', 'all')
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
    habits = [h for h in habits if h.weak()]
  elif filter_type == 'strong':
    habits = [h for h in habits if h.strong()]

  habits_data = []
  for habit in habits:
    # Reset counters if needed based on reset_freq
    habit.reset_counters()
    
    habits_data.append({
      'id': habit.id,
      'title': habit.title,
      'details': habit.details,
      'tags': [tag.name for tag in habit.tags.all()],
      'diff': habit.diff,
      'allow_pos': habit.allow_pos,
      'allow_neg': habit.allow_neg,
      'reset_freq': habit.reset_freq,
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
    'completed_at': task.completed_at.isoformat() if task.completed_at else None,
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
    diff=data.get('diff', data.get('difficulty', 'trivial')),
    allow_pos=data.get('allow_pos', data.get('allow_positive', True)),
    allow_neg=data.get('allow_neg', data.get('allow_negative', True)),
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
    # Support both field name formats for compatibility
    if 'diff' in data:
      habit.diff = data.get('diff')
    elif 'difficulty' in data:
      habit.diff = data.get('difficulty')
    if 'allow_pos' in data:
      habit.allow_pos = data.get('allow_pos')
    elif 'allow_positive' in data:
      habit.allow_pos = data.get('allow_positive')
    if 'allow_neg' in data:
      habit.allow_neg = data.get('allow_neg')
    elif 'allow_negative' in data:
      habit.allow_neg = data.get('allow_negative')
    if 'reset_freq' in data:
      habit.reset_freq = data.get('reset_freq')
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
  """Start a study session with color conflict handling"""
  data = json.loads(request.body)
  subject = data.get('subject', 'General')
  color = data.get('color', '#FFFFFF')
  carry_over_colors = data.get('carry_over_colors', False)

  now = timezone.now()
  year = now.year
  month = now.month

  StudySession.objects.filter(user=request.user, active=True).update(active=False)

  first_session_this_month = not StudySession.objects.filter(
    user=request.user,
    start_time__year=year,
    start_time__month=month,
    active=False
  ).exists()

  # If first session and user wants to carry over colors, copy last month's colors
  # Check if colors already exist for this month (might have been carried over already)
  current_month_colors_exist = SubjectColor.objects.filter(
    user=request.user,
    year=year,
    month=month
  ).exists()
  
  if first_session_this_month and carry_over_colors is True and not current_month_colors_exist:
    last_month = month - 1
    last_year = year
    if last_month == 0:
      last_month = 12
      last_year = year - 1
    
    last_month_colors = SubjectColor.objects.filter(
      user=request.user,
      year=last_year,
      month=last_month
    )

    for old_color in last_month_colors:
      SubjectColor.objects.get_or_create(
        user=request.user,
        subject=old_color.subject,
        year=year,
        month=month,
        defaults={'color': old_color.color}
      )

  # Check for color conflicts
  existing_color = SubjectColor.objects.filter(
    user=request.user,
    color=color,
    year=year,
    month=month
  ).exclude(subject=subject).first()

  subject_changed = False
  if existing_color:
    # Color is taken, change subject to the one using this color
    subject = existing_color.subject
    subject_changed = True

  # Get or create color assignment for this subject
  # Always ensure the color is set, even if the subject already exists
  subject_color_obj, created = SubjectColor.objects.get_or_create(
    user=request.user,
    subject=subject,
    year=year,
    month=month,
    defaults={'color': color}
  )

  # Always update the color to ensure it's current (unless subject was changed due to conflict)
  if not subject_changed:
    if subject_color_obj.color != color:
      subject_color_obj.color = color
      subject_color_obj.save()

  session = StudySession.objects.create(
    user=request.user,
    subject=subject,
    color=subject_color_obj.color,
  )

  profile, _ = UserProfile.objects.get_or_create(user=request.user)
  profile.avatar_state = 'studying'
  profile.save()

  return JsonResponse({
    'id': session.id,
    'success': True,
    'subject': subject,
    'subject_changed': subject_changed,
    'color': subject_color_obj.color,
  })

@login_required
@csrf_exempt
@require_http_methods(["POST", "GET"])
def api_stop_study_session(request):
  """Stop active study session or check if one exists"""
  session = StudySession.objects.filter(user=request.user, active=True).first()
  
  # If GET request, just check and return status
  if request.method == 'GET':
    response_data = {
      'has_active_session': session is not None,
      'active': session is not None,
    }
    if session:
      response_data['session_id'] = session.id
      response_data['subject'] = session.subject
      response_data['color'] = session.color or '#3b82f6'
      response_data['start_time'] = session.start_time.isoformat()
    return JsonResponse(response_data)

  if session:
    duration = session.stop()

    profile, _ = UserProfile.objects.get_or_create(user=request.user)
    profile.avatar_state = 'idle'
    xp_earned = 0
    level_up = False
    coins_earned = 0
    hours = 0

    if duration:
      hours = duration / 60.0
      profile.all_time_hours_studied += hours

      # Calculate XP rewards for study sessions
      today = timezone.now().date()
      today_start = timezone.make_aware(datetime.combine(today, datetime.min.time()))
      today_end = timezone.make_aware(datetime.combine(today, datetime.max.time()))

      today_sessions = StudySession.objects.filter(
        user=request.user,
        start_time__gte=today_start,
        start_time__lte=today_end,
        active=False
      )

      total_hours_today = sum(
        (s.duration_minutes or 0) / 60.0 for s in today_sessions
      )

      xp_per_hour = 10 if total_hours_today >= 5.0 else 5
      
      xp_earned = int(hours * xp_per_hour)

      if xp_earned > 0:
        level_up = profile.add_xp(xp_earned)
        if level_up:
          profile.avatar_state = 'celebrating'
        elif profile.avatar_state == 'hurt':
          profile.avatar_state = 'idle'

      hour_blocks = int(total_hours_today)
      previous_total_hours = total_hours_today - hours
      previous_blocks = int(previous_total_hours)

      new_blocks = hour_blocks - previous_blocks
      coins_earned = new_blocks * 1

      if coins_earned > 0:
        profile.add_coins(coins_earned)
        if profile.avatar_state != 'celebrating':
          profile.avatar_state = 'celebrating'
      
      if xp_earned > 0 and not level_up:
        if profile.avatar_state != 'celebrating':
          profile.avatar_state = 'celebrating'

    profile.save()

    return JsonResponse({
      'duration_minutes': duration,
      'success': True,
      'xp_earned': xp_earned,
      'coins_earned': coins_earned,
      'level_up': level_up,
      'hours': round(hours, 2),
    })
  
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

      level_up = profile.add_xp(xp)
      if level_up:
        profile.avatar_state = 'celebrating'
      elif profile.avatar_state == 'hurt':
        profile.avatar_state = 'idle'
      
      # Coins : easy = 1-2, medium = 2-4, hard = 4-6
      coins = 0
      if habit.diff == 'easy':
        coins = random.randint(1,2)
      elif habit.diff == 'medium':
        coins = random.randint(2,4)
      elif habit.diff == 'hard':
        coins = random.randint(4,6)
      
      if coins > 0:
        profile.add_coins(coins)
        if profile.avatar_state != 'celebrating':
          profile.avatar_state = 'celebrating'
      
      if xp > 0 and not level_up:
        if profile.avatar_state != 'celebrating':
          profile.avatar_state = 'celebrating'
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
      profile.avatar_state = 'hurt'

      profile.save()

    return JsonResponse({'success': True})
  except Habit.DoesNotExist:
    return JsonResponse({'error': 'Habit not found'}, status=404)
  
@login_required
@csrf_exempt
@require_http_methods(["POST"])
def api_complete_task(request, task_id):
  """Complete/uncomplete a task"""
  try:
    task = Task.objects.get(id=task_id, user=request.user)

    import json
    data = json.loads(request.body) if request.body else {}
    mark_completed = data.get('completed', True)

    #If uncompleting
    if not mark_completed and task.completed:
      profile, _ = UserProfile.objects.get_or_create(user=request.user)

      #Find the most recent TaskLog for task
      try:
        task_log = TaskLog.objects.filter(task=task).order_by('-created_at').first()
        if task_log:
          xp_deduct = task_log.xp_earned
          coins_deduct = task_log.coins_earned

          # Deduct XP
          current_xp = profile.xp
          current_level = profile.level

          # Remove XP
          profile.xp = max(0, profile.xp - xp_deduct)

          #Check for level-down
          if profile.xp < 0:
            levels_down = 0
            temp_xp = abs(profile.xp)
            temp_level = current_level

            while temp_xp > 0 and temp_level > 1:
              xp_needed = ((temp_level -2) + (temp_level -1)) * 30 if temp_level > 1 else 30
              if temp_xp >= xp_needed:
                temp_xp -= xp_needed
                temp_level -= 1
                levels_down += 1
              else:
                break
            
            profile.level = max(1, profile.level - levels_down)
            if profile.level < current_level:
              xp_needed = ((profile.level -1) + profile.level) * 30 if profile.level > 1 else 30
              profile.xp = max(0, xp_needed - temp_xp)
              profile.max_xp = ((profile.level - 1) + profile.level) * 30 if profile.level > 1 else 30
            else:
              profile.xp = 0

          #Remove coins
          profile.coins = max(0, profile.coins - coins_deduct)

          # Decrement all_time_tasks_completed
          profile.all_time_tasks_completed = max(0, profile.all_time_tasks_completed - 1)

          # Reverse streak if incremented
          if task.task_type == 'daily' and task.last_completed:
            from datetime import date
            today = date.today()
            last_completed_date = task.last_completed.date() if hasattr(task.last_completed, 'date') else task.last_completed
            if last_completed_date == today and task.streak > 0:
              task.streak = max(0, task.streak - 1)

          #Update longest streak if needed
          if task.task_type == 'daily' and task.streak < profile.longest_daily_streak:
            max_streak = Task.objects.filter(user=request.user, task_type='daily').aggregate(Max('streak'))['streak__max'] or 0
            profile.longest_daily_streak = max_streak

          if profile.avatar_state == 'celebrating':
            profile.avatar_state = 'idle'

          profile.save()

          #Delete task log entry
          task_log.delete()

      except Exception as e:
        pass

      task.completed = False
      task.completed_at = None

      if task.task_type == 'scheduled' and task.due and task.due < timezone.now():
        hp_loss = 2
        diff_penalty = {'trivial': 0, 'easy': 1, 'medium': 2, 'hard': 3}[task.diff]
        hp_loss += diff_penalty

        days_overdue = (timezone.now() - task.due).days
        weeks_overdue = days_overdue // 7
        if weeks_overdue > 0:
          hp_loss = hp_loss * (2 * weeks_overdue)

        profile.lose_health(hp_loss)
        profile.avatar_state = 'hurt'
        profile.save()

      task.save()
      return JsonResponse({
        'success': True,
        'level_up': False,
        'xp_earned': - xp_deduct if 'xp_deduct' in locals() else 0,
        'coins_earned': -coins_deduct if 'coins_deduct' in locals() else 0,
      })
    
    if mark_completed and not task.completed:
      task.complete()

      profile, _ = UserProfile.objects.get_or_create(user=request.user)
      
      xp = 0
      coins = 0
      
      if task.task_type == 'daily':
        # Daily rewards scale with streak
        base_min = 5
        base_max = 7
        
        # Add diff bonus : +2xp per diff
        diff_bonus = {'trivial': 0, 'easy': 2, 'medium': 4, 'hard': 6}[task.diff]
        
        # Weekly streak bonus: +5xp per week
        weeks_streak = task.streak // 7
        weekly_bonus = weeks_streak * 5
        
        xp = random.randint(base_min + diff_bonus, base_max + diff_bonus) + weekly_bonus
        level_up = profile.add_xp(xp)
        
        # Daily coins: easy = 1-3, medium = 3-5, hard = 5-7
        if task.diff == 'easy':
          coins = random.randint(1, 3)
        elif task.diff == 'medium':
          coins = random.randint(3, 5)
        elif task.diff == 'hard':
          coins = random.randint(5, 7)
        
        # Weekly streak bonus: +5 coins per week
        coins += weeks_streak * 5
        
        if coins > 0:
          profile.add_coins(coins)
      else:
        # Regular task rewards
        base_min = 5
        base_max = 10

        diff_bonus = {'trivial': 0, 'easy': 2, 'medium': 4, 'hard': 6}[task.diff]
        xp = random.randint(base_min + diff_bonus, base_max + diff_bonus)
        level_up = profile.add_xp(xp)
        
        if task.diff == 'medium':
          coins = random.randint(1,3)
        elif task.diff == 'hard':
          coins = random.randint(3,5)
        
        if coins > 0:
          profile.add_coins(coins)

      if level_up:
        profile.avatar_state = 'celebrating'
      elif xp > 0 and not level_up:
        if profile.avatar_state != 'celebrating':
          profile.avatar_state = 'celebrating'
      elif profile.avatar_state == 'hurt':
        profile.avatar_state = 'idle'
      
      profile.all_time_tasks_completed += 1

      # Update longest streak
      if task.task_type == 'daily':
        max_streak = Task.objects.filter(user=request.user, task_type='daily').aggregate(
          max_streak=Max('streak')
        )['max_streak'] or 0
        if max_streak > profile.longest_daily_streak:
          profile.longest_daily_streak = max_streak
      profile.save()

      TaskLog.objects.create(task=task, xp_earned=xp, coins_earned=coins)
      
      return JsonResponse({
        'success': True,
        'level_up': level_up,
        'xp_earned': xp,
        'coins_earned': coins,
      })
    
    return JsonResponse({
      'success': True,
      'level_up': False,
      'xp_earned': 0,
      'coins_earned': 0,
    })
  except Task.DoesNotExist:
    return JsonResponse({'error': 'Task not found'}, status=404)
  
@login_required
@require_http_methods(["GET"])
def api_check_dailies(request):
  """Check if there are pending dailies/tasks that need to be reviewed"""
  today = timezone.now().date()
  yesterday = today - timedelta(days=1)
  
  # Automatically reset dailies at the start of each day
  all_dailies = Task.objects.filter(user=request.user, task_type='daily')
  for daily in all_dailies:
    # Skip dailies created today
    if daily.created_at.date() >= today:
      continue
    
    # Check if this daily was completed yesterday or before
    needs_reset = False
    if daily.last_completed:
      last_completed_date = daily.last_completed.date() if hasattr(daily.last_completed, 'date') else daily.last_completed
      # If completed yesterday or before, it needs to be reset for today
      if last_completed_date < today:
        needs_reset = True
    elif daily.completed:
      # If marked as completed but has no last_completed date, reset it
      needs_reset = True
    
    # Reset if needed
    if needs_reset and daily.completed:
      daily.completed = False
      daily.completed_at = None
      daily.save()
  
  pending_dailies = []

  for daily in all_dailies:
    # Skip dailies created today
    if daily.created_at.date() >= today:
      continue
    
    # Check if daily was completed yesterday
    was_completed_yesterday = False
    if daily.last_completed:
      last_completed_date = daily.last_completed.date() if hasattr(daily.last_completed, 'date') else daily.last_completed
      if last_completed_date == yesterday:
        was_completed_yesterday = True
    
    # Skip if completed yesterday (user already handled it)
    if was_completed_yesterday:
      continue
    
    # Include daily if it wasn't completed yesterday
    pending_dailies.append({
      'id': daily.id,
      'title': daily.title,
      'completed': daily.completed,
      'type': 'daily',
    })
    
  yesterday_start = timezone.make_aware(datetime.combine(yesterday, datetime.min.time()))
  yesterday_end = timezone.make_aware(datetime.combine(yesterday, datetime.max.time()))

  pending_tasks = Task.objects.filter(
    user=request.user,
    task_type='scheduled',
    completed=False,
    due__gte=yesterday_start,
    due__lte=yesterday_end,
  )

  pending_tasks_data = []
  for task in pending_tasks:
    pending_tasks_data.append({
      'id': task.id,
      'title': task.title,
      'completed': task.completed,
      'type': 'task'
    })

  # Check if modal needs to be shown
  needs_check = len(pending_dailies) > 0 or len(pending_tasks_data) > 0

  return JsonResponse({
    'pending_dailies': pending_dailies,
    'pending_tasks': pending_tasks_data,
    'needs_check': needs_check,
  })

@login_required
@require_http_methods(["POST"])
def api_reset_dailies(request):
  """Reset dailies for new day; calculate penalties/rewards"""
  today = timezone.now().date()
  yesterday = today - timedelta(days=1)

  profile, _ = UserProfile.objects.get_or_create(user=request.user)

  dailies = Task.objects.filter(user=request.user, task_type='daily')

  for daily in dailies:
    # Skip dailies created today
    if daily.created_at.date() == today:
      continue

    was_completed_yesterday = False

    # Check if daily was completed yesterday or today
    if daily.last_completed:
      last_completed_date = daily.last_completed.date() if hasattr(daily.last_completed, 'date') else daily.last_completed
      if last_completed_date == yesterday or last_completed_date == today:
        was_completed_yesterday = True
    elif daily.completed:
      # If daily is marked as completed
      if daily.completed_at:
        completed_at_date = daily.completed_at.date() if hasattr(daily.completed_at, 'date') else daily.completed_at
        if completed_at_date == yesterday or completed_at_date == today:
          was_completed_yesterday = True
      else:
        was_completed_yesterday = True

    if not was_completed_yesterday:
      hp_loss = 2
      diff_penalty = {'trivial': 0, 'easy': 1, 'medium': 2, 'hard': 3}[daily.diff]
      hp_loss += diff_penalty
      profile.lose_health(hp_loss)
      if profile.avatar_state != 'celebrating':
        profile.avatar_state = 'hurt'

      if daily.streak > 0:
        daily.streak = 0

  yesterday_start = timezone.make_aware(datetime.combine(yesterday, datetime.min.time()))
  yesterday_end = timezone.make_aware(datetime.combine(yesterday, datetime.max.time()))

  overdue_tasks = Task.objects.filter(
    user = request.user,
    task_type = 'scheduled',
    completed = False,
    due__gte = yesterday_start,
    due__lte = yesterday_end,
    )
  
  for task in overdue_tasks:
    hp_loss = 2
    diff_penalty = {'trivial': 0, 'easy': 1, 'medium': 2, 'hard': 3}[task.diff]
    hp_loss += diff_penalty

    days_overdue = (timezone.now() - task.due).days
    weeks_overdue = days_overdue // 7
    if weeks_overdue > 0:
      hp_loss = hp_loss * (2 * weeks_overdue)

    profile.lose_health(hp_loss)
    if profile.avatar_state not in ['celebrating', 'celebrate']:
      profile.avatar_state = 'hurt'

  for daily in dailies:
    daily.completed = False
    daily.completed_at = None

    if not daily.last_completed:
      daily.streak = 0

    daily.save()

  habits = Habit.objects.filter(user=request.user)
  for habit in habits:
    habit.reset_counters()

  max_streak = Task.objects.filter(user=request.user, task_type='daily').aggregate(Max('streak'))['streak__max'] or 0
  if max_streak > profile.longest_daily_streak:
    profile.longest_daily_streak = max_streak

  profile.save()

  return JsonResponse({
    'success': True,
    'missed_dailies': dailies.count(),
    'overdue_tasks': overdue_tasks.count(),
  })

@login_required
@require_http_methods(["GET"])
def api_last_week_recap(request):
  """Generate last week recap with standout stats algorithm"""
  now = timezone.now()
  today = now.date()
  
  # Calculate last week (Monday to Sunday)
  days_since_monday = today.weekday()
  if days_since_monday == 0:
    last_week_end_date = today - timedelta(days=1)
  else:
    # Last week ended on the most recent Sunday
    last_week_end_date = today - timedelta(days=days_since_monday)
  
  last_week_start_date = last_week_end_date - timedelta(days=6)
  
  prev_week_start = timezone.make_aware(datetime.combine(last_week_start_date, datetime.min.time()))
  prev_week_end = timezone.make_aware(datetime.combine(last_week_end_date, datetime.max.time()))

  habits_completed = HabitLog.objects.filter(
    habit__user=request.user,
    created_at__gte=prev_week_start,
    created_at__lte=prev_week_end
  ).count()

  tasks_completed = TaskLog.objects.filter(
    task__user=request.user,
    created_at__gte=prev_week_start,
    created_at__lte=prev_week_end
  ).count()

  study_sessions = StudySession.objects.filter(
    user=request.user,
    start_time__gte=prev_week_start,
    start_time__lte=prev_week_end,
    active=False
  )
  total_study_hours = sum(s.duration_minutes or 0 for s in study_sessions) / 60

  dailies_during_week = Task.objects.filter(
    user=request.user,
    task_type='daily',
    created_at__lte=prev_week_end
  )
  missed_dailies = dailies_during_week.exclude(
    Q(last_completed__gte=prev_week_start) & Q(last_completed__lte=prev_week_end)
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

  # Study session highlights
  # Check for subject with >10 hours total in the week
  subject_hours = study_sessions.values('subject').annotate(
    total_minutes=Sum('duration_minutes')
  ).filter(total_minutes__gte=600)  # 10 hours = 600 minutes
  
  if subject_hours.exists():
    top_subject = subject_hours.order_by('-total_minutes').first()
    total_hours = top_subject['total_minutes'] / 60
    standout_items.append({
      'type': 'study',
      'title': top_subject['subject'],
      'description': f"{total_hours:.1f} hours total",
      'icon': 'clock',
      'score': int(top_subject['total_minutes'])
    })
  else:
    # Check for single day study session >2.5 hours
    # Group by subject and date, then sum duration for each day
    daily_study = study_sessions.annotate(
      study_date=TruncDate('start_time')
    ).values('subject', 'study_date').annotate(
      daily_minutes=Sum('duration_minutes')
    ).filter(daily_minutes__gte=150)  # 2.5 hours = 150 minutes
    
    if daily_study.exists():
      # Get the day with the most minutes for a single subject
      best_day = daily_study.order_by('-daily_minutes').first()
      daily_minutes_value = best_day['daily_minutes']
      hours = daily_minutes_value / 60
      standout_items.append({
        'type': 'study',
        'title': best_day['subject'],
        'description': f"{hours:.1f} hours in one day",
        'icon': 'clock',
        'score': int(daily_minutes_value)
      })

  # No missed dailies highlight
  if missed_dailies == 0 and dailies_during_week.exists():
    standout_items.append({
      'type': 'perfect_week',
      'title': 'Perfect Week',
      'description': 'No missed dailies!',
      'icon': 'star',
      'score': 100
    })

  # Level up highlight (>5 level ups in the week)
  level_ups_count = LevelLog.objects.filter(
    user=request.user,
    created_at__gte=prev_week_start,
    created_at__lte=prev_week_end
  ).count()
  
  if level_ups_count > 5:
    standout_items.append({
      'type': 'level_up',
      'title': 'Level Master',
      'description': f'Leveled up {level_ups_count} times!',
      'icon': 'star',
      'score': level_ups_count * 15
    })

  # Best habit (highest positive to negative ratio) - removed, no longer showing thumbs-up items
  # habits = Habit.objects.filter(user=request.user)
  # for habit in habits:
  #   total = habit.pos_count + habit.neg_count
  #   if total >= 5: # Minimum activity
  #     ratio = habit.pos_count /total if total > 0 else 0
  #     if ratio >= 0.8:
  #       standout_items.append({
  #         'type': 'habit_ratio',
  #         'title': habit.title,
  #         'description': f"{int(ratio * 100)}% positive",
  #         'icon': 'star',
  #         'score': int(ratio * 100)
  #       })
  #       break

  # Sort by score
  standout_items.sort(key=lambda x: x['score'], reverse=True)

  # Find best habit for "Stopped Procrastination" card
  best_habit_title = "Stopped Procrastination"
  best_habit = None
  best_score = 0
  
  all_habits = Habit.objects.filter(user=request.user)
  for habit in all_habits:
    # If only positive is allowed, use highest pos_count
    if not habit.allow_neg and habit.allow_pos:
      if habit.pos_count > best_score:
        best_score = habit.pos_count
        best_habit = habit
    # Otherwise, check for good pos/neg ratio
    elif habit.allow_neg and habit.allow_pos:
      total = habit.pos_count + habit.neg_count
      if total >= 3:  # Minimum activity threshold
        ratio = habit.pos_count / total if total > 0 else 0
        # Consider it "good" if ratio >= 0.7 (70% positive)
        if ratio >= 0.7:
          # Score based on ratio and total activity
          score = ratio * 100 + (total * 0.1)
          if score > best_score:
            best_score = score
            best_habit = habit
  
  if best_habit:
    best_habit_title = best_habit.title

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
    'best_habit_title': best_habit_title,
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
    max_streak = Task.objects.filter(user=request.user, task_type='daily').aggregate(
      max_streak=Max('streak')
    )['max_streak'] or 0
    # Update profile
    if max_streak > profile.longest_daily_streak:
      profile.longest_daily_streak = max_streak
      profile.save()
    return JsonResponse({'value': max(profile.longest_daily_streak, max_streak)})
  
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
  # Get user's purchased items
  purchased_item_ids = set(UserPurchase.objects.filter(user=request.user).values_list('item_id', flat=True))
  
  # Get user-defined items
  user_items = ShopItem.objects.filter(user=request.user, active=True, item_type='character')
  user_items_data = []
  for item in user_items:
    user_items_data.append({
      'id': item.id,
      'name': item.name,
      'description': item.description,
      'item_type': item.item_type,
      'price': item.price,
      'image_url': item.image_url,
    })
  
  # Get customization items
  customization_items = ShopItem.objects.filter(active=True, item_type='customization').exclude(id__in=purchased_item_ids)
  customization_items_data = []
  for item in customization_items:
    customization_items_data.append({
      'id': item.id,
      'name': item.name,
      'description': item.description,
      'item_type': item.item_type,
      'price': item.price,
      'image_url': item.image_url,
    })
  
  # Add default background color items
  background_colors = [
    {
      'name': bg_data['name'],
      'color': bg_data['color'],
      'floor_color': bg_data['floor_color']
    }
    for bg_id, bg_data in BACKGROUND_COLORS.items()
  ]
  
  # Refresh profile to ensure we have latest data
  profile, _ = UserProfile.objects.get_or_create(user=request.user)
  profile = UserProfile.objects.get(user=request.user)
  current_bg = getattr(profile, 'avatar_background_color', None) or None
  
  # Get purchased backgrounds from profile
  purchased_background_ids = set()
  if hasattr(profile, 'purchased_backgrounds') and profile.purchased_backgrounds:
    try:
      purchased_backgrounds_list = json.loads(profile.purchased_backgrounds) if isinstance(profile.purchased_backgrounds, str) else profile.purchased_backgrounds
      purchased_background_ids = set(purchased_backgrounds_list)
    except:
      purchased_background_ids = set()
  
  for bg in background_colors:
    bg_id = f'bg_{bg["name"].lower().replace(" ", "_")}'
    
    # Check if this background was purchased
    bg_purchased = bg_id in purchased_background_ids
    
    # Don't show default background in shop
    is_default = bg['color'] == '#d8b9b9'
    
    should_show = bg_id not in purchased_item_ids and not bg_purchased and not is_default
    
    if should_show:
      customization_items_data.append({
        'id': bg_id,
        'name': bg['name'],
        'description': 'Customize your avatar background color',
        'item_type': 'customization',
        'price': 50,
        'image_url': '',
        'background_color': bg['color'],
        'floor_color': bg['floor_color'],
      })

  return JsonResponse({
    'user_items': user_items_data,
    'customization_items': customization_items_data
  })

@login_required
@csrf_exempt
@require_http_methods(["POST"])
def api_purchase_item(request):
  """Purchase item from shop"""
  data = json.loads(request.body)
  item_id = data.get('item_id')

  try:
    # Handle background color purchases (virtual items)
    if isinstance(item_id, str) and item_id.startswith('bg_'):
      profile, _ = UserProfile.objects.get_or_create(user=request.user)
      price = 50
      
      if profile.coins < price:
        return JsonResponse({'error': 'Insufficient coins'}, status=400)
      
      # Get background from constant
      bg = None
      if item_id in BACKGROUND_COLORS:
        bg_data = BACKGROUND_COLORS[item_id]
        bg = {
          'color': bg_data['color'],
          'floor_color': bg_data['floor_color']
        }
      
      if not bg:
        return JsonResponse({'error': 'Background not found'}, status=404)
      
      # Deduct coins but DON'T auto-equip - user must equip manually from inventory
      profile.coins -= price
      
      # Track purchased background in a JSON field
      # Get or initialize purchased_backgrounds list
      purchased_backgrounds = []
      if hasattr(profile, 'purchased_backgrounds') and profile.purchased_backgrounds:
        try:
          purchased_backgrounds = json.loads(profile.purchased_backgrounds) if isinstance(profile.purchased_backgrounds, str) else profile.purchased_backgrounds
        except:
          purchased_backgrounds = []
      
      # Add this background ID if not already in list
      if item_id not in purchased_backgrounds:
        purchased_backgrounds.append(item_id)
        # Store as JSON string
        profile.purchased_backgrounds = json.dumps(purchased_backgrounds)
      
      profile.save()
      
      return JsonResponse({
        'success': True, 
        'coins_left': profile.coins
      })
    
    # Handle regular shop items
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
  except Exception as e:
    logger = logging.getLogger(__name__)
    logger.error(f"Error purchasing item: {str(e)}", exc_info=True)
    return JsonResponse({'error': f'Purchase failed: {str(e)}'}, status=500)

@login_required
@csrf_exempt
@require_http_methods(["POST"])
def api_create_reward(request):
  """Create a new user-defined reward"""
  logger = logging.getLogger(__name__)
  try:
    data = json.loads(request.body)
    
    name = data.get('name', '').strip()
    description = data.get('description', '').strip()
    try:
      price = int(data.get('price', 0))
    except (ValueError, TypeError):
      return JsonResponse({'error': 'Price must be a valid number'}, status=400)
    
    if not name:
      return JsonResponse({'error': 'Name is required'}, status=400)
    
    if price < 1:
      return JsonResponse({'error': 'Price must be at least 1'}, status=400)
    
    reward = ShopItem.objects.create(
      user=request.user,
      name=name,
      description=description or '',
      price=price,
      item_type='character',
      active=True
    )
    
    return JsonResponse({
      'id': reward.id,
      'success': True
    })
  except ValueError as e:
    logger.error(f"Invalid data creating reward: {str(e)}", exc_info=True)
    return JsonResponse({'error': f'Invalid data: {str(e)}'}, status=400)
  except Exception as e:
    logger.error(f"Error creating reward: {str(e)}", exc_info=True)
    return JsonResponse({'error': f'Failed to create reward: {str(e)}'}, status=500)

@login_required
@csrf_exempt
@require_http_methods(["PUT"])
def api_update_reward(request, reward_id):
  """Update an existing user-defined reward"""
  try:
    reward = ShopItem.objects.get(id=reward_id, user=request.user, item_type='character')
    data = json.loads(request.body)
    
    if 'name' in data:
      reward.name = data['name'].strip()
    if 'description' in data:
      reward.description = data.get('description', '').strip()
    if 'price' in data:
      price = data.get('price', 0)
      if price < 1:
        return JsonResponse({'error': 'Price must be at least 1'}, status=400)
      reward.price = price
    
    reward.save()
    
    return JsonResponse({
      'id': reward.id,
      'success': True
    })
  except ShopItem.DoesNotExist:
    return JsonResponse({'error': 'Reward not found'}, status=404)
  except Exception as e:
    logger = logging.getLogger(__name__)
    logger.error(f"Error updating reward: {str(e)}", exc_info=True)
    return JsonResponse({'error': f'Failed to update reward: {str(e)}'}, status=500)

@login_required
@csrf_exempt
@require_http_methods(["DELETE"])
def api_delete_reward(request, reward_id):
  """Delete a user-defined reward"""
  try:
    reward = ShopItem.objects.get(id=reward_id, user=request.user, item_type='character')
    reward.delete()
    
    return JsonResponse({'success': True})
  except ShopItem.DoesNotExist:
    return JsonResponse({'error': 'Reward not found'}, status=404)
  except Exception as e:
    logger = logging.getLogger(__name__)
    logger.error(f"Error deleting reward: {str(e)}", exc_info=True)
    return JsonResponse({'error': f'Failed to delete reward: {str(e)}'}, status=500)

@login_required
@require_http_methods(["GET"])
def api_owned_customization(request):
  """Get user's owned customization items"""
  profile, _ = UserProfile.objects.get_or_create(user=request.user)
  # Refresh profile to ensure we have latest data
  profile.refresh_from_db()
  
  # Get purchased shop items
  purchased_items = UserPurchase.objects.filter(user=request.user).select_related('item')
  owned_items = {
    'avatars': [],
    'shirts': [],
    'pants': [],
    'socks': [],
    'shoes': [],
    'backgrounds': []
  }
  
  # Default items
  owned_items['avatars'].append({
    'id': 'default_girl',
    'name': 'Default Girl',
    'type': 'avatar',
    'is_default': True
  })
  
  owned_items['shirts'].append({
    'id': 'default',
    'name': 'Default Shirt',
    'type': 'shirt',
    'is_default': True
  })
  
  owned_items['pants'].append({
    'id': 'default',
    'name': 'Default Pants',
    'type': 'pants',
    'is_default': True
  })
  
  owned_items['socks'].append({
    'id': 'default',
    'name': 'Default Socks',
    'type': 'socks',
    'is_default': True
  })
  
  owned_items['shoes'].append({
    'id': 'default',
    'name': 'Default Shoes',
    'type': 'shoes',
    'is_default': True
  })
  
  # Default background
  owned_items['backgrounds'].append({
    'id': 'default',
    'name': 'Default',
    'color': '#d8b9b9',
    'floor_color': '#d8aeae',
    'type': 'background',
    'is_default': True
  })
  
  # Add purchased backgrounds
  # Use the constant for background colors
  background_colors = BACKGROUND_COLORS
  
  # Get purchased backgrounds from profile
  purchased_background_ids = set()
  if hasattr(profile, 'purchased_backgrounds') and profile.purchased_backgrounds:
    try:
      purchased_backgrounds_list = json.loads(profile.purchased_backgrounds) if isinstance(profile.purchased_backgrounds, str) else profile.purchased_backgrounds
      purchased_background_ids = set(purchased_backgrounds_list)
    except:
      purchased_background_ids = set()
  
  # Add all purchased to owned
  for bg_id in purchased_background_ids:
    if bg_id in background_colors:
      bg_data = background_colors[bg_id]
      if not any(bg['id'] == bg_id for bg in owned_items['backgrounds']):
        owned_items['backgrounds'].append({
          'id': bg_id,
          'name': bg_data['name'],
          'color': bg_data['color'],
          'floor_color': bg_data['floor_color'],
          'type': 'background',
          'is_default': False
        })
  
  current_bg = getattr(profile, 'avatar_background_color', None) or None
  if current_bg:
    current_bg_str = str(current_bg).strip().lower()
    if current_bg_str != '#d8b9b9':
      for bg_id, bg_data in background_colors.items():
        bg_color_normalized = str(bg_data['color']).strip().lower()
        if current_bg_str == bg_color_normalized:
          # Add if not already in list
          if not any(bg['id'] == bg_id for bg in owned_items['backgrounds']):
            owned_items['backgrounds'].append({
              'id': bg_id,
              'name': bg_data['name'],
              'color': bg_data['color'],
              'floor_color': bg_data['floor_color'],
              'type': 'background',
              'is_default': False
            })
  
  # Add purchased shop items
  for purchase in purchased_items:
    item = purchase.item
    if item.item_type == 'customization':
      # Future: add clothing/avatar items here
      pass
  
  return JsonResponse({'owned_items': owned_items})
  
@login_required
@require_http_methods(["GET"])
def api_study_stats(request):
  """Get monthly study stats (subject, day)"""
  view_type = request.GET.get('type', 'monthly')
  now = timezone.now()

  if view_type == 'monthly':
    month_offset = int(request.GET.get('month_offset', 0))
    target_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if month_offset != 0:
      month = target_date.month + month_offset
      year = target_date.year
      while month > 12:
        month -= 12
        year += 1
      while month < 1:
        month += 12
        year -= 1
      target_date = target_date.replace(year=year, month=month)
    
    start_of_month = target_date
    if target_date.month == 12:
      end_of_month = target_date.replace(year=target_date.year + 1, month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
      end_of_month = target_date.replace(month=target_date.month + 1, day=1, hour=0, minute=0, second=0, microsecond=0)

    sessions = StudySession.objects.filter(
      user=request.user,
      start_time__gte=start_of_month,
      start_time__lt=end_of_month,
      active=False
    )

    year = target_date.year
    month = target_date.month
    color_legend = {}
    subject_colors = SubjectColor.objects.filter(
      user=request.user,
      year=year,
      month=month
    )
    for sc in subject_colors:
      color_legend[sc.subject] = sc.color

    stats_by_day = {}
    stats_by_subject = {}
    total_hours = 0

    # Initialize all subjects with 0 hours
    for subject in color_legend.keys():
      stats_by_subject[subject] = 0

    for session in sessions:
      day = session.start_time.date()
      day_str = day.isoformat()
      subject = session.subject
      duration_hours = (session.duration_minutes or 0) / 60.0
      total_hours += duration_hours

      if day_str not in stats_by_day:
        stats_by_day[day_str] = {}
      if subject not in stats_by_day[day_str]:
        stats_by_day[day_str][subject] = 0
      stats_by_day[day_str][subject] += duration_hours

      if subject not in stats_by_subject:
        stats_by_subject[subject] = 0
      stats_by_subject[subject] += duration_hours

    return JsonResponse({
      'type': 'monthly',
      'year': year,
      'month': month,
      'by_day': stats_by_day,
      'by_subject': stats_by_subject,
      'color_legend': color_legend,
      'total_hours': round(total_hours, 2),
    })
  
  else:
    week_offset = int(request.GET.get('week_offset', 0))
    
    # Calculate current week (Monday to Sunday)
    days_since_monday = now.weekday()
    start_of_current_week = (now - timedelta(days=days_since_monday)).replace(hour=0, minute=0, second=0, microsecond=0)
    start_of_week = start_of_current_week + timedelta(days=week_offset * 7)
    end_of_week = start_of_week + timedelta(days=7)

    sessions = StudySession.objects.filter(
      user=request.user,
      start_time__gte=start_of_week,
      start_time__lt=end_of_week,
      active=False
    )

    stats_by_day = {}
    stats_by_subject = {}
    total_hours = 0
    subjects_in_week = set()

    # First pass: collect all subjects that appear in this week's sessions
    for session in sessions:
      subjects_in_week.add(session.subject)

    # Get color legend only for subjects that appear in this week
    # Use the month that contains the start of the week
    week_year = start_of_week.year
    week_month = start_of_week.month
    color_legend = {}
    
    # Get colors for subjects that appear in this week
    subject_colors = SubjectColor.objects.filter(
      user=request.user,
      year=week_year,
      month=week_month,
      subject__in=subjects_in_week
    )
    for sc in subject_colors:
      color_legend[sc.subject] = sc.color
    
    # Also check if week spans into next month and get colors from there too
    if end_of_week.month != week_month or end_of_week.year != week_year:
      next_month_year = end_of_week.year
      next_month_month = end_of_week.month
      next_month_colors = SubjectColor.objects.filter(
        user=request.user,
        year=next_month_year,
        month=next_month_month,
        subject__in=subjects_in_week
      )
      for sc in next_month_colors:
        # Only add if not already in color_legend (prioritize start of week month)
        if sc.subject not in color_legend:
          color_legend[sc.subject] = sc.color

    # Initialize all subjects with 0 hours
    for subject in color_legend.keys():
      stats_by_subject[subject] = 0

    for session in sessions:
      day = session.start_time.date()
      day_str = day.isoformat()
      subject = session.subject
      duration_hours = (session.duration_minutes or 0) / 60.0
      total_hours += duration_hours

      if day_str not in stats_by_day:
        stats_by_day[day_str] = {
          'subjects': {},
          'sessions': []
        }
      
      if subject not in stats_by_day[day_str]['subjects']:
        stats_by_day[day_str]['subjects'][subject] = 0
      stats_by_day[day_str]['subjects'][subject] += duration_hours

      stats_by_day[day_str]['sessions'].append({
        'subject': subject,
        'start_time': session.start_time.isoformat(),
        'duration_minutes': session.duration_minutes or 0,
        'color': session.color or color_legend.get(subject, '#FFFFFF'),
      })

      if subject not in stats_by_subject:
        stats_by_subject[subject] = 0
      stats_by_subject[subject] += duration_hours

    return JsonResponse({
      'type': 'weekly',
      'start_date': start_of_week.isoformat(),
      'end_date': end_of_week.isoformat(),
      'by_day': stats_by_day,
      'by_subject': stats_by_subject,
      'color_legend': color_legend,
      'total_hours': round(total_hours, 2),
    })
  
@login_required
@csrf_exempt
@require_http_methods(['POST'])
def api_carry_over_colors(request):
  """Carry over colors from last month to current month"""
  try:
    now = timezone.now()
    year = now.year
    month = now.month
    
    # Check if this is the first session of the month
    first_session_this_month = not StudySession.objects.filter(
      user=request.user,
      start_time__year=year,
      start_time__month=month,
      active=False
    ).exists()
    
    if not first_session_this_month:
      return JsonResponse({'error': 'Not the first session of the month'}, status=400)
    
    # Calculate last month
    last_month = month - 1
    last_year = year
    if last_month == 0:
      last_month = 12
      last_year = year - 1
    
    # Get last month's colors
    last_month_colors = SubjectColor.objects.filter(
      user=request.user,
      year=last_year,
      month=last_month
    )
    
    if not last_month_colors.exists():
      return JsonResponse({'error': 'No colors to carry over from last month'}, status=400)
    
    # Copy colors to current month
    carried_over_count = 0
    for old_color in last_month_colors:
      obj, created = SubjectColor.objects.get_or_create(
        user=request.user,
        subject=old_color.subject,
        year=year,
        month=month,
        defaults={'color': old_color.color}
      )
      if created:
        carried_over_count += 1
    
    return JsonResponse({
      'success': True,
      'carried_over_count': carried_over_count,
      'color_legend': {sc.subject: sc.color for sc in SubjectColor.objects.filter(
        user=request.user,
        year=year,
        month=month
      )}
    })
  except Exception as e:
    import traceback
    traceback.print_exc()
    return JsonResponse({'error': str(e)}, status=500)

@login_required
@csrf_exempt
@require_http_methods(['GET', 'POST'])
def api_subject_colors(request):
  """Get or update subject color legend for current month"""
  try:
    now = timezone.now()
    year = now.year
    month = now.month

    if request.method == 'GET':
      # Check if requesting last month's colors
      get_last_month = request.GET.get('last_month', 'false').lower() == 'true'
      
      if get_last_month:
        last_month = month - 1
        last_year = year
        if last_month == 0:
          last_month = 12
          last_year = year - 1
        
        subject_colors = SubjectColor.objects.filter(
          user=request.user,
          year=last_year,
          month=last_month
        )
      else:
        subject_colors = SubjectColor.objects.filter(
          user=request.user,
          year=year,
          month=month
        )
      
      color_legend = {}
      used_colors = set()
      for sc in subject_colors:
        color_legend[sc.subject] = sc.color
        used_colors.add(sc.color)

      return JsonResponse({
        'color_legend': color_legend,
        'used_colors': list(used_colors),
      })  

    else:
      data = json.loads(request.body)
      color_legend = data.get('color_legend', {})
      subject_renames = data.get('subject_renames', {})  # Maps new_name -> old_name

      # Handle subject renames first
      for new_name, old_name in subject_renames.items():
        if new_name != old_name:
          # Update all StudySession records for this month
          StudySession.objects.filter(
            user=request.user,
            subject=old_name,
            start_time__year=year,
            start_time__month=month
          ).update(subject=new_name)
          
          # Update SubjectColor
          SubjectColor.objects.filter(
            user=request.user,
            subject=old_name,
            year=year,
            month=month
          ).update(subject=new_name)
      
      # Update or create all subjects with their colors
      new_subjects = set(color_legend.keys())
      for subject, color in color_legend.items():
        SubjectColor.objects.update_or_create(
          user=request.user,
          subject=subject,
          year=year,
          month=month,
          defaults={'color': color}
        )
      
      # Delete subjects that are no longer in the legend
      SubjectColor.objects.filter(
        user=request.user,
        year=year,
        month=month
      ).exclude(subject__in=new_subjects).delete()

      return JsonResponse({'success': True})
  except Exception as e:
    import traceback
    traceback.print_exc()
    return JsonResponse({'error': str(e)}, status=500)
  