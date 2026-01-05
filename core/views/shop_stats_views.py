from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.utils import timezone
from django.db.models import Max, Sum, Q
from django.db.models.functions import TruncDate
from datetime import datetime, timedelta
import json
import logging

from ..models import (
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
from ..constants import BACKGROUND_COLORS

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

