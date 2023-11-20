using AutoMapper;
using UsersBlazor.DataLayer;

namespace UsersBlazorApi
{
    public class MapperConfig
    {
        public static MapperConfiguration RegisterMaps()
        {
            var mappingConfig = new MapperConfiguration(config =>
            {
                config.CreateMap<User, User>();
            });
            return mappingConfig;
        }
    }
}
