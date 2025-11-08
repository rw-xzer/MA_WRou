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

  # All time stats
  all_time_hours_studied = models.FloatField(default=0.0)
  all_time_tasks_completed = models.IntegerField(default=0)
  all_time_habits_completed = models.IntegerField(default=0)
  longest_daily_streak = models.IntegerField(default=0)
  all_time_coins_earned = models.IntegerField(default=0)
  highest_level_ever = models.IntegerField(default=1)


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
      self.all_time_coins_earned += 10

      if self.level > self.highest_level_ever:
        self.highest_level_ever = self.level

      # Log level up
      LevelLog.objects.create(user=self.user, level=self.level)

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
    self.all_time_coins_earned += amount


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
    #Use HSL interpolation for smoother gradient
    def rgb_to_hsl(r, g, b):
      """Convert RGB to HSL"""
      r, g, b = r / 255.0, g / 255.0, b / 255.0
      max_val = max(r, g, b)
      min_val = min(r, g, b)
      diff = max_val - min_val
      l = (max_val + min_val) / 2.0

      if diff == 0:
        h = s = 0
      else:
        s = diff / (2.0 - max_val - min_val) if l > 0.5 else diff / (max_val + min_val)

        if max_val == r:
          h = ((g - b) / diff + (6 if g < b else 0)) / 6.0
        elif max_val == g:
          h = ((b - r) / diff + 2) / 6.0
        else:
          h = ((r - g) /diff + 4) / 6.0

      return h, s, l
    
    def hsl_to_rgb(h, s, l):
      """Convert HSL to RGB"""
      if s == 0:
        r = g= b = 1
      else:
        def hue_to_rgb(p, q, t):
          if t < 0: t += 1
          if t > 1: t -= 1
          if t < 1/6: return p + (q - p) * 6 * t
          if t < 1/2: return q
          if t < 2/3: return p + (q - p) * (2/3 - t) * 6
          return p

        q = l * (1 + s) if l < 0.5 else l + s - l * s
        p = 2 * l - q
        r = hue_to_rgb(p, q, h + 1/3)
        g = hue_to_rgb(p, q, h)
        b = hue_to_rgb(p, q, h - 1/3)

      return int(r * 255), int(g * 255), int(b * 255)

    def interpolate_hsl(color1, color2, t):
      """Interpolate between two hex colors in HSL space"""
      r1, g1, b1 = int(color1[1:3], 16), int(color1[3:5], 16), int(color1[5:7], 16)
      r2, g2, b2 = int(color2[1:3], 16), int(color2[3:5], 16), int(color2[5:7], 16)

      h1, s1, l1 = rgb_to_hsl(r1, g1, b1)
      h2, s2, l2 = rgb_to_hsl(r2, g2, b2)

      # Handle hue wrap-around
      if abs(h2 - h1) > 0.5:
        if h1 > h2:
          h2 += 1.0
        else:
          h1 += 1.0

      h = (h1 + (h2 - h1) * t) % 1.0
      s = s1 + (s2 - s1) * t
      l = l1 + (l2 - l1) * t

      r, g, b = hsl_to_rgb(h, s, l)
      return f'#{r:02x}{g:02x}{b:02x}'

    #Map ratio to gradient segments
    if ratio <= 0.33:
      # Red to Orange (0.0 to 0.33)
      t = ratio / 0.33
      return interpolate_hsl('#b42828', '#d2642d', t)
    elif ratio <= 0.50:
      # Orange to Cyan
      t = (ratio - 0.33) / 0.17
      return interpolate_hsl('#d2642d', '#44b8c7', t)
    else:
      # Cyan to Blue
      t = (ratio - 0.50) / 0.50
      return interpolate_hsl('#44b8c7', '#2396b4', t)
    
  def strong(self):
    """Check if habit is strong (pos_count / neg_count > 3)"""
    if self.neg_count == 0:
      return self.pos_count > 0
    return self.pos_count > self.neg_count * 3
  
  def weak(self):
    """Check if habit is weak (neg_count / pos_count > 1)"""
    if self.pos_count == 0:
      return self.neg_count > 0
    return self.neg_count > self.pos_count
  
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
  
class SubjectColor(models.Model):
  """Monthly color assignments for subjects"""
  user = models.ForeignKey(User, on_delete=models.CASCADE)
  subject = models.CharField(max_length = 100)
  color = models.CharField(max_length=7)
  year = models.IntegerField()
  month = models.IntegerField()
  created_at = models.DateTimeField(auto_now_add=True)

  class Meta:
    unique_together = ['user', 'subject', 'year', 'month']
    indexes = [
      models.Index(fields=['user', 'year', 'month']),]

class StudySession(models.Model):
  """Study sessions with subject and duration tracking"""
  user = models.ForeignKey(User, on_delete=models.CASCADE)
  subject = models.CharField(max_length=100)
  color = models.CharField(max_length=7, null=True, blank=True)
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
  xp_earned = models.IntegerField(default=0)
  coins_earned = models.IntegerField(default=0)

class LevelLog(models.Model):
  """Log entries for level ups"""
  user = models.ForeignKey(User, on_delete=models.CASCADE)
  level = models.IntegerField()
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