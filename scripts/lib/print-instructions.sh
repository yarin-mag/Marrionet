#!/usr/bin/env bash
#
# Marionette - Print Final Instructions
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/helpers.sh"

print_final_instructions() {
    print_header "Setup Complete! 🎉"

    echo -e "${GREEN}${BOLD}Marionette is ready to use!${NC}"
    echo ""
    echo -e "${CYAN}${BOLD}Next Steps:${NC}"
    echo ""
    echo -e "  ${YELLOW}1.${NC} Reload your shell to activate the wrapper:"
    echo -e "     ${BLUE}source ~/.zshrc${NC}  ${CYAN}# or ~/.bashrc${NC}"
    echo ""
    echo -e "  ${YELLOW}2.${NC} Start Marionette services:"
    echo -e "     ${BLUE}./start.sh${NC}"
    echo ""
    echo -e "  ${YELLOW}3.${NC} Open the dashboard:"
    echo -e "     ${BLUE}open http://localhost:5173${NC}"
    echo ""
    echo -e "  ${YELLOW}4.${NC} Start Claude with tracking:"
    echo -e "     ${BLUE}claude${NC}"
    echo ""
    echo -e "${CYAN}${BOLD}Features Enabled:${NC}"
    echo -e "  ${GREEN}✓${NC} Process tracking with real PIDs"
    echo -e "  ${GREEN}✓${NC} Claude hooks for all lifecycle events"
    echo -e "  ${GREEN}✓${NC} MCP tools (set task, report tokens, Jira tracking)"
    echo -e "  ${GREEN}✓${NC} Real-time WebSocket updates"
    echo -e "  ${GREEN}✓${NC} Multi-agent monitoring"
    echo ""
    echo -e "${CYAN}${BOLD}Useful Commands:${NC}"
    echo -e "  ${BLUE}./start.sh${NC}              - Start all services"
    echo -e "  ${BLUE}./stop.sh${NC}               - Stop all services"
    echo -e "  ${BLUE}docker-compose logs -f${NC}  - View database logs"
    echo ""
    echo -e "${YELLOW}💡 Tip:${NC} Your agents will automatically appear in the dashboard"
    echo -e "    with names like ${CYAN}\"Claude [PID 12346]\"${NC} for easy identification!"
    echo ""
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    print_final_instructions
fi
