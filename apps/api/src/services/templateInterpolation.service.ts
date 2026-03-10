export interface InterpolationVariables {
  customer_name?: string;
  agent_name?: string;
  conversation_id?: string;
  order_number?: string;
  [key: string]: string | undefined;
}

export class TemplateInterpolationService {
  /**
   * Interpolates variables in a template string
   * @param template - Template string with variables in {{variable_name}} format
   * @param variables - Object containing variable values
   * @returns Interpolated string with variables replaced
   */
  interpolate(template: string, variables: InterpolationVariables): string {
    if (!template) {
      return '';
    }

    let result = template;

    // Replace all {{variable_name}} patterns with their values
    const variablePattern = /\{\{(\w+)\}\}/g;
    result = result.replace(variablePattern, (match, variableName: string) => {
      const value = variables[variableName];
      // If variable is not provided, keep the placeholder
      return value !== undefined && value !== null ? value : match;
    });

    return result;
  }

  /**
   * Extracts variable names from a template string
   * @param template - Template string with variables in {{variable_name}} format
   * @returns Array of variable names found in the template
   */
  extractVariables(template: string): string[] {
    if (!template) {
      return [];
    }

    const variablePattern = /\{\{(\w+)\}\}/g;
    const variables: string[] = [];
    let match;

    while ((match = variablePattern.exec(template)) !== null) {
      const variableName = match[1] as string;
      if (!variables.includes(variableName)) {
        variables.push(variableName);
      }
    }

    return variables;
  }

  /**
   * Validates that all required variables are provided
   * @param template - Template string with variables
   * @param variables - Object containing variable values
   * @returns Object with isValid flag and array of missing variables
   */
  validate(
    template: string,
    variables: InterpolationVariables
  ): { isValid: boolean; missing: string[] } {
    const requiredVariables = this.extractVariables(template);
    const missing = requiredVariables.filter(
      (varName) => variables[varName] === undefined
    );

    return {
      isValid: missing.length === 0,
      missing,
    };
  }

  /**
   * Interpolates bilingual template (both English and Arabic)
   * @param template - Object with content and contentAr fields
   * @param variables - Object containing variable values
   * @returns Object with interpolated content and contentAr
   */
  interpolateBilingual(
    template: { content: string; contentAr?: string },
    variables: InterpolationVariables
  ): { content: string; contentAr: string } {
    return {
      content: this.interpolate(template.content, variables),
      contentAr: this.interpolate(template.contentAr || '', variables),
    };
  }
}

export const templateInterpolationService = new TemplateInterpolationService();
