using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace UsersBlazor.DataLayer
{
    public interface IUserRegistrationService
    {
        Task<ResponseDto> GetUsersAsync(int pageNo, int pageSize);
        Task<ResponseDto> GetUserByIdAsync(int id);
        Task<ResponseDto> AddUserAsync(User user);
        Task<ResponseDto> UpdateUserAsync(User user);
        Task<ResponseDto> DeleteUserAsync(int userId);
    }
}
