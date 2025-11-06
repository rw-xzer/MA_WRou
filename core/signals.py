from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User
from .models import UserProfile, Habit, Task, Tag, ShopItem

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
  """Create UserProfile and examples when a new user is created"""
  if created:
    # Ensure default tags exist
    default_tags = ["Work", "Health", "Creativity", "Study", "Exercise", "Hobby", "Chores"]
    for tag_name in default_tags:
      Tag.objects.get_or_create(name=tag_name)
      
    profile = UserProfile.objects.create(user=instance)
    habit = Habit.objects.create(
      user=instance,
      title="Study/Procastinate",
      details="Track whether you studied or proocastinated today",
      diff='medium',
      allow_neg=True,
      allow_pos=True,
      reset_freq="monthly"
    )

    task = Task.objects.create(
      user=instance,
      title="Add a task",
      diff='easy',
      task_type='scheduled',
      due=None
    )

    reward = ShopItem.objects.create(
      user=instance,
      name="play a game",
      description="A fun reward for completing tasks",
      item_type='reward',
      price=10,
      active=True
    )