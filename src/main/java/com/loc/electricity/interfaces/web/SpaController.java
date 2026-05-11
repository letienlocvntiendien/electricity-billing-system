package com.loc.electricity.interfaces.web;

import org.springframework.boot.webmvc.error.ErrorController;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;

@Controller
public class SpaController implements ErrorController {

    // @RequestMapping (all methods): error dispatch từ Servlet container không giới hạn HTTP method
    @RequestMapping("/error")
    public String handleError() {
        return "forward:/index.html";
    }

    // @GetMapping (GET only): browser navigation luôn là GET
    // Regex [^\\.]* loại path có dấu chấm → static files (.js, .css, .ico) không bị intercept
    // /api/** được @RestController xử lý trước do Spring MVC ưu tiên mapping cụ thể hơn
    @GetMapping(value = {"/", "/{path:[^\\.]*}", "/{path:[^\\.]*}/**"})
    public String forward() {
        return "forward:/index.html";
    }
}
