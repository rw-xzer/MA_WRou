from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.utils import timezone
from django.db.models import Max, Q
from datetime import datetime, timedelta
import json
import random

from ..models import (
    UserProfile,
    Habit,
    Task,
    StudySession,
    SubjectColor,
    Tag,
    HabitLog,
    TaskLog,
)

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
    'user_id': request.user.id,
    'username': request.user.username,
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

      # Reset streak if daily was not completed
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

    # Reset streak for dailies that were never completed
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

