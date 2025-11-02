from django.urls import path
from . import views

urlpatterns = [
  path("login/", views.login_view, name="login"),
  path("accounts/login/", views.login_view, name="login"),
  path("logout/", views.logout_view, name="logout"),
  path("", views.index, name="index"),
  path("stats/", views.stats_page, name="stats"),
  path("shop/", views.shop_page, name="shop"),

  # API endpoints
  path("api/profile/", views.api_user_profile, name="api_profile"),
  path("api/habits/", views.api_habits, name="api_habits"),
  path("api/tasks/", views.api_tasks, name="api_tasks"),
  path("api/habits/create/", views.api_create_habit, name="api_create_habit"),
  path("api/habits/<int:habit_id>/update/", views.api_update_habit, name="api_update_habit"),
  path("api/habits/<int:habit_id>/delete/", views.api_delete_habit, name="api_delete_habit"),
  path("api/tasks/create/", views.api_create_task, name="api_create_task"),
  path("api/tasks/<int:task_id>/update/", views.api_update_task, name="api_update_task"),
  path("api/tasks/<int:task_id>/delete/", views.api_delete_task, name="api_delete_task"),
  path("api/habits/study/start/", views.api_start_study_session, name="api_start_study"),
  path("api/habits/study/stop/", views.api_stop_study_session, name="api_stop_study"),
  path("api/habits/<int:habit_id>/complete/", views.api_complete_habit, name="api_complete_habit"),
  path("api/tasks/<int:task_id>/complete/", views.api_complete_task, name="api_complete_task"),
  path("api/dailies/check", views.api_check_dailies, name="api_check_dailies"),
  path("api/dailies/reset", views.api_reset_dailies, name="api_reset_dailies"),
  path("api/recap/", views.api_last_week_recap, name="api_recap"),
  path("api/stats/slots/", views.api_stat_slots, name="api_stat_slots"),
  path("api/stats/value/", views.api_stat_value, name="api_stat_value"),
  path("api/tags/", views.api_tags, name="api_tags"),
  path("api/shop/purchase/", views.api_purchase_item, name="api_purchase_item"),
  path("api/shop/items/", views.api_shop_items, name="api_shop_items"),
  path("api/study/stats/", views.api_study_stats, name="api_study_stats"),
  path("api/study/colors", views.api_subject_colors, name="api_subject_colors"),
]