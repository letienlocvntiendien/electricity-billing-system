package com.loc.electricity.interfaces.web;

import org.springframework.boot.webmvc.error.ErrorController;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

@Controller
public class SpaController implements ErrorController {

    // Suppresses Spring Boot's Whitelabel Error Page.
    // All errors (404, 500, etc.) serve index.html so React renders its own error UI.
    // @RequestMapping (not @GetMapping) because error dispatch is not limited to GET.
    @RequestMapping("/error")
    public String handleError() {
        return "forward:/index.html";
    }
}
