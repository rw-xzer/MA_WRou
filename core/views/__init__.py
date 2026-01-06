# Import all views from the split files
from .auth_views import (
    login_view,
    logout_view,
    register_view,
    index,
    stats_page,
    shop_page,
)

from .game_views import (
    api_user_profile,
    api_habits,
    api_tasks,
    api_create_habit,
    api_update_habit,
    api_delete_habit,
    api_complete_habit,
    api_create_task,
    api_update_task,
    api_delete_task,
    api_complete_task,
    api_start_study_session,
    api_stop_study_session,
    api_check_dailies,
    api_reset_dailies,
)

from .shop_stats_views import (
    api_last_week_recap,
    api_stat_slots,
    api_stat_value,
    api_tags,
    api_shop_items,
    api_purchase_item,
    api_create_reward,
    api_update_reward,
    api_delete_reward,
    api_owned_customization,
    api_study_stats,
    api_carry_over_colors,
    api_subject_colors,
)

__all__ = [
    # Auth views
    'login_view',
    'logout_view',
    'register_view',
    'index',
    'stats_page',
    'shop_page',
    # Game views
    'api_user_profile',
    'api_habits',
    'api_tasks',
    'api_create_habit',
    'api_update_habit',
    'api_delete_habit',
    'api_complete_habit',
    'api_create_task',
    'api_update_task',
    'api_delete_task',
    'api_complete_task',
    'api_start_study_session',
    'api_stop_study_session',
    'api_check_dailies',
    'api_reset_dailies',
    # Shop & Stats views
    'api_last_week_recap',
    'api_stat_slots',
    'api_stat_value',
    'api_tags',
    'api_shop_items',
    'api_purchase_item',
    'api_create_reward',
    'api_update_reward',
    'api_delete_reward',
    'api_owned_customization',
    'api_study_stats',
    'api_carry_over_colors',
    'api_subject_colors',
]

