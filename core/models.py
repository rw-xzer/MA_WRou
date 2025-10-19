from django.db import models

# Create your models here.
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta, datetime
import json

class UserProfile(models.Model):
  """User profile with stats"""
  user = models.OneToOneField(User, on_delete=models.CASCADE)
  level = models.IntegerField(default=1)
  xp = models.IntegerField(default=0)
  max_xp = models.IntegerField(default=30)
  hp = models.IntegerField(default=50)
  max_hp = models.IntegerField(default=50)
  coins = models.IntegerField(default=0)
  avatar = models.CharField(max_length=100, default='default_avatar.png')
  avatar_state = models.CharField(max_length=20, default='idle')

  def calculate_xp_for_lvl(self):
    """Calculate xp needed for next level"""
    return int(((self.level - 1) + self.level) * 30)
  
  def add_xp(self, amount):
    """Add xp and check for lvl up"""
    self.xp += amount
    xp_needed = self.calculate_xp_for_lvl()
    if self.xp >= xp_needed:
      self.level += 1
      self.xp -= xp_needed
      self.max_xp = self.calculate_xp_for_lvl()

      self.hp = self.max_hp
      self.coins += 10

      return True # Level up occurred
    return False
  
  def lose_health(self, amount):
    """Lose health, check for lvl loss"""
    self.hp = max(0, self.hp - amount)
    if self.hp == 0:
      self.level = max(1, self.level - 1)
      self.xp = 0
      self.max_xp = self.calculate_xp_for_lvl()
      self.hp = self.max_hp
      self.coins = 0
      return True # Level lost
    return False
  
  def add_coins(self, amount):
    """Add coins (0-5 for tasks/habits, 10 for lvl up)"""
    self.coins += amount


class Tag(models.Model):
  """Tags for habits and tasks"""
  name = models.CharField(max_length=50, unique=True)
  
  def __str__(self):
    return self.name
  
class Habit(models.Model):
  """Habits (tracked negative/postive/both)"""
  DIFF_CHOICES = [
    ('trivial', 'Trivial'),
    ('easy', 'Easy'),
    ('medium', 'Medium'),
    ('hard', 'Hard'),
  ]

  RESET_FREQ_CHOICES = [
    ('daily', 'Daily'),
    ('weekly', 'Weekly'),
    ('monthly', 'Monthly'),
    ('never', 'Never'),
  ]

  user = models.ForeignKey(User, on_delete=models.CASCADE)
  title = models.CharField(max_length=100)
  details = models.TextField(blank=True)
  tags = models.ManyToManyField(Tag, blank=True)
  diff = models.CharField(max_length=10, choices=DIFF_CHOICES, default='trivial')

  allow_pos = models.BooleanField(default=True)
  allow_neg = models.BooleanField(default=True)
  pos_count = models.IntegerField(default=0)
  neg_count = models.IntegerField(default=0)
  
  reset_freq = models.CharField(max_length=10, choices=RESET_FREQ_CHOICES, default='never')
  last_reset = models.DateTimeField(auto_now_add=True)
  created_at = models.DateTimeField(auto_now_add=True)

  def get_color(self):
    """Color based on pos/neg ratio (red-blue)"""
    total = self.pos_count + self.neg_count
    if total == 0:
      return '#d2642d' # Color for no activity
    
    ratio = self.pos_count / total if total > 0 else 0

    # Red: rgb (180, 40, 40), Blue: rgb (35, 150, 180)
    if ratio == 0:
      return '#b42828'
    elif ratio < 0.25:
      return '#c54028'
    elif ratio < 0.5:
      return '#d2642d'
    elif ratio < 0.75:
      return "#44b8c7"
    else:
      return '#2396b4'
    
  def strong(self):
    """Check if habit is strong"""
    return self.pos_count > self.neg_count * 2
  
  def incr_neg(self):
    """Increment negative counter"""
    self.neg_count += 1
    self.save()

  def incr_pos(self):
    """Increment positive counter"""
    self.pos_count += 1
    self.save()

  def reset_counters(self):
    """Reset counters on set frequency"""
    now = timezone.now()
    reset = False

    if self.reset_freq == 'daily':
      reset = (now - self.last_reset).days >= 1
    elif self.reset_freq == 'weekly':
      reset = (now - self.last_reset).days >= 7
    elif self.reset_freq == 'monthly':
      reset = (now - self.last_reset).days >= 30
    
    if reset:
      self.pos_count = 0
      self.neg_count = 0
      self.last_reset = now
      self.save()


class Task(models.Model):
  """Tasks (scheduled/daily)"""
  DIFF_CHOICES = [
    ('trivial', 'Trivial'),
    ('easy', 'Easy'),
    ('medium', 'Medium'),
    ('hard', 'Hard'),
  ]

  TASK_TYPE_CHOICES =[
    ('scheduled', 'Scheduled'),
    ('daily', 'Daily'),
  ]

  user = models.ForeignKey(User, on_delete=models.CASCADE)
  title = models.CharField(max_length=100)
  details = models.TextField(blank=True)
  tags = models.ManyToManyField(Tag, blank=True)
  diff = models.CharField(max_length=10, choices=DIFF_CHOICES, default='trivial')
  task_type = models.CharField(max_length=10, choices=TASK_TYPE_CHOICES, default='scheduled')
  due = models.DateTimeField(null=True, blank=True)
  completed = models.BooleanField(default=False)
  completed_at = models.DateTimeField(null=True, blank=True)
  streak = models.IntegerField(default=0)
  last_completed = models.DateTimeField(null=True, blank=True)
  created_at = models.DateTimeField(auto_now_add=True)

  def get_color(self):
    """Color based on streak or status"""
    if self.task_type == 'scheduled':
      if not self.due:
        return '#d2642d'
      
      now = timezone.now()
      if self.due < now:
        return '#b42828' # Overdue
      
      days_left = (self.due - now).days
      if days_left == 0:
        return '#b42828'
      elif days_left <= 3:
        return '#c54028'
      else:
        return '#d2642d'
      
    else: # Daily task
      if self.streak == 0:
        return '#d2642d'
      elif self.streak >= 15:
        return '#2396b4'
      else:
        # Orange to blue
        ratio = min(self.streak / 15, 1.0)
        if ratio < 0.25:
          return '#d2642d'
        elif ratio < 0.5:
          return '#ff9800'
        elif ratio < 0.75:
          return '#44b8c7'
        else:
          return '#2396b4'
      
  def complete(self):
    """Mark task as complete"""
    self.completed = True
    self.completed_at = timezone.now()

    if self.task_type == 'daily':
      now = timezone.now()
      today = now.date()
      if self.last_completed:
        last_completed_date = self.last_completed.date() if isinstance(self.last_completed, timezone.datetime) else self.last_completed
        yesterday = last_completed_date + timedelta(days=1)
        if today == yesterday:
          self.streak += 1
        elif today > yesterday:
          self.streak = 1
      else:
        self.streak = 1

      self.last_completed = timezone.make_aware(timezone.datetime.combine(today, timezone.datetime.min.time()))
    
    self.save()

  def overdue(self):
    """Check if scheduled task is overdue"""
    if self.task_type == 'scheduled' and self.due:
      return timezone.now() > self.due and not self.completed
    return False
  
class StudySession(models.Model):
  """Study sessions with subject and duration tracking"""
  user = models.ForeignKey(User, on_delete=models.CASCADE)
  subject = models.CharField(max_length=100)
  start_time = models.DateTimeField(auto_now_add=True)
  end_time = models.DateTimeField(null=True, blank=True)
  duration_minutes = models.IntegerField(null=True, blank=True)
  active = models.BooleanField(default=True)

  def stop(self):
    """Stop the study session and calculate duration"""
    if self.active:
      self.end_time = timezone.now()
      duration = self.end_time - self.start_time
      self.duration_minutes = int(duration.total_seconds() / 60)
      self.active = False
      self.save()
      return self.duration_minutes
    return 0
  

class HabitLog(models.Model):
  """Log entries for habit completions"""
  habit = models.ForeignKey(Habit, on_delete=models.CASCADE)
  positive = models.BooleanField()
  created_at = models.DateTimeField(auto_now_add=True)

class TaskLog(models.Model):
  """Log entries for task completions"""
  task = models.ForeignKey(Task, on_delete=models.CASCADE)
  created_at = models.DateTimeField(auto_now_add=True)

class StatSlot(models.Model):
  """User custom stat display slots"""
  STAT_CHOICES = [
    ('hours_studied', 'Hours Studied'),
    ('tasks_completed', 'Tasks Completed'),
    ('habits_completed', 'Habits Completed'),
    ('longest_streak', 'Longest Streak'),
    ('current_streak', 'Current Streak'),
    ('coins_earned', 'Coins Earned'),  
  ]

  user = models.ForeignKey(User, on_delete=models.CASCADE)
  slot_number = models.IntegerField()
  stat_type = models.CharField(max_length=20, choices=STAT_CHOICES, null=True, blank=True)

  class Meta:
    unique_together = ['user', 'slot_number']


class ShopItem(models.Model):
  """Items available in the shop"""
  ITEM_TYPE_CHOICES = [
    ('character', 'Character'),
    ('customization', 'Customization'),
  ]

  name = models.CharField(max_length=100)
  description = models.TextField()
  item_type = models.CharField(max_length=20, choices=ITEM_TYPE_CHOICES)
  price = models.IntegerField()
  image_url = models.CharField(max_length=200, blank=True)
  active = models.BooleanField(default=True)

class UserPurchase(models.Model):
  """User purchases from shop"""
  user = models.ForeignKey(User, on_delete=models.CASCADE)
  item = models.ForeignKey(ShopItem, on_delete=models.CASCADE)
  purchased_at = models.DateTimeField(auto_now_add=True)

  class Meta:
    unique_together = ['user', 'item']