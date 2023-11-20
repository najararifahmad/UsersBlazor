using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace UsersBlazor.DataLayer
{
    public class User
    {
        [Key]
        public int ID { get; set; }
        [Required(ErrorMessage = "First Name can not be empty!")]
        [RegularExpression("([A-ZÀ-ÿ][a-z']+[ ]*)+", ErrorMessage = "Only alphabets and spaces allowed in First Name")]
        public string FirstName { get; set; }
        [Required(ErrorMessage = "Last Name can not be empty")]
        [RegularExpression("([A-ZÀ-ÿ][a-z']+[ ]*)+", ErrorMessage = "Only alphabets and spaces allowed in Last Name")]
        public string LastName { get; set; }
        [Required(ErrorMessage = "Email Id can not be empty")]
        [EmailAddress(ErrorMessage = "Invalid Email Id")]
        public string Email { get; set; }
    }
}
