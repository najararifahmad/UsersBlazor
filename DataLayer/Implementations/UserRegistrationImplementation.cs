using AutoMapper;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace UsersBlazor.DataLayer.Implementations
{
    public class UserRegistrationImplementation : IUserRegistrationService
    {
        private readonly ApplicationDbContext _context;
        private readonly IMapper _mapper;
        public UserRegistrationImplementation(ApplicationDbContext context, IMapper mapper)
        {
            _context = context;
            _mapper = mapper;
        }
        public async Task<ResponseDto> AddUserAsync(User user)
        {
            try
            {
                await _context.Users.AddAsync(user);
                await _context.SaveChangesAsync();
                return new ResponseDto
                {
                    IsSuccess = true,
                    Message = "User registered successfully."
                };
            }
            catch(Exception ex)
            {
                return new ResponseDto
                {
                    IsSuccess = false,
                    Message = "Error occured. Please try again..."
                };
            }
        }

        public async Task<ResponseDto> DeleteUserAsync(int userId)
        {
            try
            {
                var userInDb = await _context.Users.AsQueryable().FirstOrDefaultAsync(u => u.ID == userId);
                if (userInDb == null)
                {
                    return new ResponseDto
                    {
                        IsSuccess = false,
                        Message = "User not found. Please try again...",
                    };
                }

                _context.Users.Remove(userInDb);
                await _context.SaveChangesAsync();

                return new ResponseDto
                {
                    IsSuccess = true,
                    Message = "User deleted successfully."
                };
            }
            catch(Exception ex)
            {
                return new ResponseDto
                {
                    IsSuccess = false,
                    Message = "Error occured. Please try again..."
                };
            }
        }

        public async Task<ResponseDto> GetUserByIdAsync(int id)
        {
            try
            {
                var userInDb = await _context.Users.AsQueryable<User>().FirstOrDefaultAsync(u => u.ID == id);
                if(userInDb != null)
                {
                    return new ResponseDto
                    {
                        IsSuccess = true,
                        Message = "User found.",
                        Users = new List<User>(new[] { userInDb })
                    };
                }
                return new ResponseDto
                {
                    IsSuccess = false,
                    Message = "User not found."
                };
            }
            catch(Exception ex)
            {
                return new ResponseDto
                {
                    IsSuccess = false,
                    Message = "Error occured. Please try again..."
                };
            }
        }

        public async Task<ResponseDto> GetUsersAsync(int pageNo, int pageSize)
        {
            try
            {
                var usersInDb = await _context.Users.AsQueryable<User>()
                    .Skip(pageNo * pageSize).Take(pageSize).ToListAsync();

                var totalItems = await _context.Users.CountAsync();

                if(usersInDb != null)
                {
                    return new ResponseDto
                    {
                        IsSuccess = true,
                        Message = "Returning Users with given page no. and page size",
                        Users = usersInDb,
                        TotalItems = totalItems
                    };
                }
                return new ResponseDto
                {
                    IsSuccess = false,
                    Message = "Unable to retrieve users for the given criteria."
                };
            }
            catch(Exception ex)
            {
                return new ResponseDto
                {
                    IsSuccess = false,
                    Message = "Error occured. Please try again.........." + ex.Message
                };
            }
        }

        public async Task<ResponseDto> UpdateUserAsync(User user)
        {
            try
            {
                User userToUpdate = _mapper.Map<User>(user);
                _context.Users.Update(userToUpdate);
                await _context.SaveChangesAsync();
                return new ResponseDto
                {
                    IsSuccess = true,
                    Message = "User updated successfully."
                };
            }
            catch(Exception ex)
            {
                return new ResponseDto
                {
                    IsSuccess = false,
                    Message = "Error occured. Please try again..."
                };
            }
        }
    }
}
