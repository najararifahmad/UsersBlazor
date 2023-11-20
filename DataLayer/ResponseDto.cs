using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace UsersBlazor.DataLayer
{
    public class ResponseDto
    {
        public bool IsSuccess { get; set; }
        public string Message { get; set; }
        public List<User>? Users { get; set; }
        public int? TotalItems { get; set; }
    }
}
