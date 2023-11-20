using UsersBlazor.DataLayer;

namespace UsersBlazor.Client
{
    public class UserRegistrationClient
    {
        private readonly IUserRegistrationService _userRegistrationService;
        public UserRegistrationClient(IUserRegistrationService userRegistrationService)
        {
            _userRegistrationService = userRegistrationService;
        }

        public async Task<object> GetUsersAsync(int pageNo, int pageSize)
        {
            return await _userRegistrationService.GetUsersAsync(pageNo, pageSize);
        }
        public async Task<object> AddUserAsync(User user)
        {
            return await _userRegistrationService.AddUserAsync(user);
        }
    }
}
